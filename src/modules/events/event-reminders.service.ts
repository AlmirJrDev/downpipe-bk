import { eventsRepository, EventRow } from './events.repository';
import { eventChatRepository } from '@/modules/event-chat/event-chat.repository';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';
import { pushService } from '@/shared/push/push.service';

/**
 * Lembrete do rolê que está chegando.
 *
 * O resto do app avisa por reação — mensagem nova, horário mudou, cancelou.
 * Faltava o aviso que ninguém dispara: o rolê é amanhã. Quem confirmou há duas
 * semanas e não voltou na tela esquecia, e encontro vazio desanima quem
 * organiza.
 *
 * Roda de tempos em tempos (ver `iniciarLembretesDeRole`) e é seguro repetir:
 * cada rolê guarda em `reminder_sent_at` que já foi avisado.
 */

/** Quanto antes o lembrete sai. Meio-termo entre "dá tempo de se organizar" e "já esqueci de novo". */
const HORAS_DE_ANTECEDENCIA = 20;

/** "hoje às 14:00" / "amanhã às 14:00" / "sábado, 26/09 às 14:00" — sempre em Brasília. */
export function quandoPorExtenso(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  // Compara o DIA em Brasília, não as 24h corridas: um rolê às 9h de amanhã
  // está a 15 horas de distância, mas pra quem lê ele é "amanhã", não "hoje".
  const emSaoPaulo = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hoje = emSaoPaulo(agora);
  const amanha = emSaoPaulo(new Date(agora.getTime() + 86_400_000));
  const dia = emSaoPaulo(data);

  if (dia === hoje) return `hoje às ${hora}`;
  if (dia === amanha) return `amanhã às ${hora}`;

  const porExtenso = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return `${porExtenso} às ${hora}`;
}

async function avisarSobre(evento: EventRow, agora: Date): Promise<number> {
  const participantes = await eventChatRepository.participantIds(evento.id, evento.organizer_id);

  // Rolê sem ninguém confirmado além de quem criou não vira push: o
  // organizador sabe do próprio rolê, e ser lembrado do que você mesmo marcou
  // parece defeito, não cuidado.
  if (participantes.length <= 1) return 0;

  const corpo = `${quandoPorExtenso(evento.starts_at, agora)} · ${evento.location}, ${evento.city}`;
  let enviados = 0;

  for (const userId of participantes) {
    // O organizador também recebe: ele quer saber se o rolê dele é amanhã
    // tanto quanto os outros — e é ele quem chega primeiro.
    const badge = await notificationsRepository.countUnread(userId);
    await pushService.sendToUser(userId, {
      title: evento.name,
      body: corpo,
      url: `/app/event/${evento.id}`,
      badge,
    });
    enviados += 1;
  }

  return enviados;
}

export const eventRemindersService = {
  /**
   * Manda os lembretes pendentes. Devolve o resumo pra quem chamou logar.
   *
   * Marca o rolê como avisado mesmo quando não havia ninguém pra avisar:
   * o que importa é não ficar reprocessando o mesmo rolê a cada 15 minutos.
   */
  async enviarPendentes(agora = new Date()) {
    const ate = new Date(agora.getTime() + HORAS_DE_ANTECEDENCIA * 3600_000).toISOString();
    const eventos = await eventsRepository.paraLembrar(ate);

    let avisos = 0;
    for (const evento of eventos) {
      try {
        avisos += await avisarSobre(evento, agora);
        await eventsRepository.marcarLembreteEnviado(evento.id);
      } catch (err) {
        // Um rolê com problema não pode impedir o lembrete dos outros. Sem a
        // marca, ele entra de novo na próxima rodada.
        // eslint-disable-next-line no-console
        console.warn('Falha no lembrete do rolê', evento.id, err instanceof Error ? err.message : err);
      }
    }

    return { roles: eventos.length, avisos };
  },
};

/**
 * Liga o agendador dentro do próprio processo do backend.
 *
 * Sem serviço de fila nem cron externo: o app é um processo só, e um
 * `setInterval` resolve o problema inteiro. A repetição é inofensiva porque
 * `reminder_sent_at` garante um aviso por rolê. O único cuidado é o serviço
 * dormir por inatividade (plano free da Render) — aí os lembretes saem quando
 * ele acorda, o que qualquer visita ao app provoca. Um ping externo de 10 em
 * 10 minutos em /health resolve isso de graça, se o atraso incomodar.
 */
export function iniciarLembretesDeRole(intervaloEmMinutos = 15) {
  const rodar = () => {
    eventRemindersService
      .enviarPendentes()
      .then(({ roles, avisos }) => {
        if (roles > 0) {
          // eslint-disable-next-line no-console
          console.log(`Lembretes de rolê: ${roles} rolê(s), ${avisos} aviso(s).`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Lembretes de rolê falharam:', err instanceof Error ? err.message : err);
      });
  };

  // A primeira rodada espera um pouco: na subida o processo está ocupado
  // respondendo as primeiras requisições, e nada aqui é urgente ao segundo.
  const inicial = setTimeout(rodar, 30_000);
  const repetido = setInterval(rodar, intervaloEmMinutos * 60_000);

  // unref: um timer pendurado não pode segurar o processo no ar quando o
  // servidor for encerrado (deploy, teste, Ctrl+C).
  inicial.unref?.();
  repetido.unref?.();

  return () => {
    clearTimeout(inicial);
    clearInterval(repetido);
  };
}
