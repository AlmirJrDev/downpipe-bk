import { AppError } from '@/shared/utils/AppError';
import { pushService } from '@/shared/push/push.service';
import { eventsRepository, EventRow } from '@/modules/events/events.repository';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';
import { eventChatRepository, MessageRow } from './event-chat.repository';

/** Quantas mensagens a tela recebe de cada vez. */
const JANELA = 50;

/**
 * Leitura mais recente que isso = a pessoa está com o chat aberto agora (a
 * tela confere mensagens novas a cada poucos segundos, e cada conferida conta
 * como leitura). Mandar push pra quem já está vendo a mensagem na tela só
 * faria o celular vibrar à toa.
 */
const NA_TELA_MS = 30_000;

function toPublicMessage(row: MessageRow) {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    createdAt: row.created_at,
    author:
      row.author_id && row.profiles
        ? {
            id: row.author_id,
            username: row.profiles.username,
            displayName: row.profiles.display_name,
            avatarUrl: row.profiles.avatar_url,
          }
        : null,
  };
}

async function eventoOuErro(eventId: string): Promise<EventRow> {
  const event = await eventsRepository.findById(eventId);
  if (!event) throw AppError.notFound('EVENT_NOT_FOUND', 'Evento não encontrado');
  return event;
}

/**
 * Só entra quem vai: o organizador e quem confirmou presença.
 *
 * Um chat aberto a qualquer um que tenha o link viraria vitrine pra spam, e
 * quem confirmou é justamente quem precisa saber que o horário mudou.
 */
async function participacao(eventId: string, userId: string) {
  const event = await eventoOuErro(eventId);
  const organizador = event.organizer_id === userId;
  if (!organizador && !(await eventChatRepository.isAttendee(eventId, userId))) {
    throw new AppError('CHAT_SO_CONFIRMADOS', 'Confirme presença no rolê pra entrar no chat.', 403);
  }
  return { event, organizador };
}

function resumo(texto: string) {
  return texto.length > 120 ? `${texto.slice(0, 117)}...` : texto;
}

/**
 * Push das mensagens novas, sem virar metralhadora.
 *
 * Mensagem comum avisa uma vez por "rajada": a primeira mensagem nova depois
 * da última vez que a pessoa abriu o chat gera um push, e as seguintes não,
 * até ela abrir de novo. Num rolê animado, isso é a diferença entre um aviso
 * e cinquenta.
 *
 * Aviso do organizador e mensagem do sistema (horário ou local mudou) furam
 * essa regra e sempre avisam: são exatamente o que a pessoa não pode perder.
 *
 * Nunca lança, pela mesma regra de todo push do app: falhar aqui não pode
 * fazer a mensagem em si parecer que não foi enviada.
 */
async function avisar(event: EventRow, mensagem: MessageRow) {
  try {
    const autor = mensagem.author_id;
    const doOrganizador = autor === event.organizer_id;
    const importante = mensagem.kind === 'sistema' || doOrganizador;

    const destinatarios = (await eventChatRepository.participantIds(event.id, event.organizer_id)).filter(
      (id) => id !== autor
    );
    if (destinatarios.length === 0) return;

    const leituras = new Map(
      (await eventChatRepository.reads(event.id, destinatarios)).map((r) => [r.user_id, r])
    );

    const texto = resumo(mensagem.text);
    const body =
      mensagem.kind === 'sistema'
        ? texto
        : doOrganizador
          ? `Aviso do organizador: ${texto}`
          : `@${mensagem.profiles?.username ?? 'alguém'}: ${texto}`;

    const agora = Date.now();
    for (const id of destinatarios) {
      const leitura = leituras.get(id);

      if (leitura && agora - Date.parse(leitura.last_read_at) < NA_TELA_MS) continue;

      const jaAvisadoDesdeQueLeu =
        !!leitura?.last_pushed_at && Date.parse(leitura.last_pushed_at) >= Date.parse(leitura.last_read_at);
      if (!importante && jaAvisadoDesdeQueLeu) continue;

      // Bloqueio vale nos dois sentidos, igual ao feed: nem quem bloqueou nem
      // quem foi bloqueado recebe push da mensagem do outro.
      if (autor && (await moderationRepository.listHiddenIds(id)).includes(autor)) continue;

      const badge = await notificationsRepository.countUnread(id);
      await pushService.sendToUser(id, {
        title: event.name,
        body,
        url: `/app/event-chat/${event.id}`,
        badge,
      });
      await eventChatRepository.markPushed(event.id, id, !!leitura);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Falha ao avisar o chat do rolê:', err instanceof Error ? err.message : err);
  }
}

export const eventChatService = {
  /**
   * Uma janela de mensagens. Sem nada: as mais recentes. Com `desde`: o que
   * chegou a partir dali (é como a tela confere mensagens novas). Com
   * `antes`: as anteriores, pra rolar pra cima.
   *
   * Abrir ou conferir o chat conta como leitura — é isso que zera o contador
   * e libera o próximo push.
   */
  async list(eventId: string, userId: string, janela: { desde?: string; antes?: string }) {
    const { event, organizador } = await participacao(eventId, userId);

    const [linhas, escondidos] = await Promise.all([
      eventChatRepository.list(eventId, { ...janela, limite: janela.desde ? 200 : JANELA }),
      moderationRepository.listHiddenIds(userId),
    ]);

    // Inclui as mensagens de quem a pessoa bloqueou: escondidas não são "não
    // lidas", e não podem ficar travando o contador.
    if (!janela.antes) {
      await eventChatRepository.markRead(eventId, userId, linhas.at(-1)?.created_at);
    }

    return {
      organizerId: event.organizer_id,
      isOrganizer: organizador,
      // Menos que a janela cheia = não há nada mais antigo pra buscar.
      hasOlder: !janela.desde && linhas.length === JANELA,
      messages: linhas
        .filter((m) => !m.author_id || !escondidos.includes(m.author_id))
        .map(toPublicMessage),
    };
  },

  async send(eventId: string, userId: string, text: string) {
    const { event } = await participacao(eventId, userId);
    const linha = await eventChatRepository.create(eventId, userId, text.trim());

    // Quem escreveu está com o chat aberto: a própria mensagem não pode
    // aparecer como não lida pra ele.
    await eventChatRepository.markRead(eventId, userId, linha.created_at);

    void avisar(event, linha);
    return toPublicMessage(linha);
  },

  /** O autor apaga a própria; o organizador apaga qualquer uma do seu rolê. */
  async remove(messageId: string, userId: string) {
    const mensagem = await eventChatRepository.findById(messageId);
    if (!mensagem) throw AppError.notFound('MESSAGE_NOT_FOUND', 'Mensagem não encontrada');

    const event = await eventoOuErro(mensagem.event_id);
    const podeApagar = mensagem.author_id === userId || event.organizer_id === userId;
    if (!podeApagar) {
      throw AppError.forbidden('Só quem escreveu ou quem organiza o rolê pode apagar a mensagem');
    }

    await eventChatRepository.delete(messageId);
  },

  /**
   * Não lidas, pro contador na tela do rolê. null pra quem não participa:
   * a tela usa isso pra nem mostrar o botão do chat.
   */
  async unread(eventId: string, userId: string): Promise<number | null> {
    try {
      await participacao(eventId, userId);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 403) return null;
      throw err;
    }
    return eventChatRepository.countUnread(eventId, userId);
  },

  /**
   * Mensagem escrita pelo próprio app — mudança de horário ou de local. Sai
   * sempre com push, porque é o motivo de o chat existir.
   */
  async systemMessage(eventId: string, text: string) {
    const event = await eventoOuErro(eventId);
    const linha = await eventChatRepository.create(eventId, null, text);
    void avisar(event, linha);
  },

  /**
   * Cancelamento, em dois tempos.
   *
   * A lista de quem avisar tem que ser lida ANTES de apagar o rolê: depois,
   * confirmados e chat somem em cascata, e não sobra ninguém. Já o envio fica
   * pra DEPOIS, devolvido como função, pra quem cancela não esperar um push
   * por confirmado antes de ver a tela responder.
   *
   * Rolê que já aconteceu não avisa: apagar um evento antigo é faxina, não
   * cancelamento, e ninguém precisa ser acordado por isso.
   */
  async prepararAvisoDeCancelamento(event: EventRow): Promise<() => Promise<void>> {
    const semAviso = async () => undefined;
    if (Date.parse(event.starts_at) < Date.now()) return semAviso;

    let destinatarios: string[];
    try {
      destinatarios = (await eventChatRepository.participantIds(event.id, event.organizer_id)).filter(
        (id) => id !== event.organizer_id
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao ler quem avisar do cancelamento:', err instanceof Error ? err.message : err);
      return semAviso;
    }

    return async () => {
      for (const id of destinatarios) {
        try {
          const badge = await notificationsRepository.countUnread(id);
          // O toque abre a home: o rolê não vai existir mais.
          await pushService.sendToUser(id, {
            title: event.name,
            body: 'Rolê cancelado pelo organizador.',
            url: '/app',
            badge,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Falha ao avisar um confirmado do cancelamento:', err instanceof Error ? err.message : err);
        }
      }
    };
  },
};
