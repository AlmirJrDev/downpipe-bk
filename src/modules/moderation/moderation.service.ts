import { AppError } from '@/shared/utils/AppError';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { followsRepository } from '@/modules/follows/follows.repository';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';
import { pushService } from '@/shared/push/push.service';
import { moderationRepository } from './moderation.repository';
import { CreateReportInput, ReportReason } from './moderation.schema';

/** Mesmos rótulos da folha de denúncia do app (components/ReportSheet.tsx). */
export const MOTIVO: Record<ReportReason, string> = {
  conteudo_improprio: 'Conteúdo impróprio',
  spam: 'Spam ou propaganda',
  assedio: 'Assédio ou ofensa',
  carro_nao_e_meu: 'Foto de carro usada sem permissão',
  informacao_falsa: 'Informação falsa',
  outro: 'Outro motivo',
};

/**
 * Avisa quem modera, por push, que chegou denúncia nova.
 *
 * Antes a denúncia entrava na tabela e parava lá: ninguém era avisado, e
 * as lojas exigem resposta rápida a denúncias. O toque abre o próprio
 * conteúdo denunciado quando ele tem uma tela — post e perfil têm;
 * comentário abre o post onde ele está.
 *
 * Nunca lança, pela mesma regra do push de notificação: uma falha aqui não
 * pode fazer a denúncia em si parecer que falhou pra quem denunciou. O
 * resto (ver a fila, agir) é com `npm run moderar`.
 */
async function avisarModeracao(reporterId: string, input: CreateReportInput) {
  try {
    const admins = await moderationRepository.listAdminIds();
    if (admins.length === 0) {
      // Fica no log em vez de sumir: uma fila que ninguém vê é pior do que
      // não ter fila, e o único sinal disso seria este aviso.
      // eslint-disable-next-line no-console
      console.warn('Denúncia recebida e ninguém na tabela admins pra avisar.');
      return;
    }

    const alvo = await moderationRepository.describeTarget(input);
    const body = `${MOTIVO[input.reason]} · ${alvo.rotulo}`;

    for (const adminId of admins) {
      // Quem denunciou não precisa do próprio aviso: o app já respondeu
      // "denúncia registrada" na tela dele.
      if (adminId === reporterId) continue;

      const badge = await notificationsRepository.countUnread(adminId);
      await pushService.sendToUser(adminId, { title: 'Nova denúncia', body, url: alvo.url, badge });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Falha ao avisar moderação:', err instanceof Error ? err.message : err);
  }
}

export const moderationService = {
  async report(reporterId: string, input: CreateReportInput) {
    // Denunciar o próprio perfil não faz sentido e só sujaria a fila.
    if (input.profileId && input.profileId === reporterId) {
      throw AppError.validation('Você não pode denunciar o seu próprio perfil');
    }

    const nova = await moderationRepository.createReport(reporterId, input);

    // Só denúncia nova avisa: a mesma pessoa repetindo a mesma denúncia não
    // é informação nova pra moderação, e viraria um jeito de spammar o celular
    // de quem modera.
    if (nova) void avisarModeracao(reporterId, input);

    // Resposta igual mesmo quando a denúncia já existia: dizer "você já
    // denunciou isso" não ajuda em nada e só faz a pessoa duvidar se funcionou.
    return { message: 'Denúncia registrada. Obrigado por avisar.' };
  },

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw AppError.validation('Você não pode bloquear a si mesmo');
    }

    const alvo = await profilesRepository.findById(blockedId);
    if (!alvo) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    await moderationRepository.block(blockerId, blockedId);

    /**
     * Bloquear desfaz o seguir dos dois lados.
     *
     * Sem isso a pessoa bloqueada continua na sua lista de seguidores e
     * some do feed sem explicação — e o contador do perfil passa a contar
     * alguém que você não quer por perto.
     */
    await followsRepository.delete(blockerId, blockedId).catch(() => undefined);
    await followsRepository.delete(blockedId, blockerId).catch(() => undefined);

    return { blocked: true };
  },

  async unblock(blockerId: string, blockedId: string) {
    await moderationRepository.unblock(blockerId, blockedId);
    return { blocked: false };
  },

  async listBlocked(userId: string) {
    const linhas = await moderationRepository.listBlocked(userId);

    return linhas.map((linha) => {
      const p = linha.profiles as unknown as {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
      };
      return {
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        blockedAt: linha.created_at,
      };
    });
  },

  /**
   * A fila de denúncias, pronta pra tela.
   *
   * Existia só no `npm run moderar`, o que obrigava quem modera a estar no
   * computador com o projeto aberto — enquanto o push da denúncia chega no
   * celular. Aqui vai tudo que a decisão precisa: motivo, quem denunciou, o
   * alvo com o texto dele e o endereço pra abrir.
   */
  async fila(status: 'open' | 'reviewed' = 'open') {
    const linhas = await moderationRepository.listReports(status);

    return Promise.all(
      linhas.map(async (linha) => {
        const alvo = await moderationRepository.describeTarget({
          postId: linha.post_id ?? undefined,
          commentId: linha.comment_id ?? undefined,
          profileId: linha.profile_id ?? undefined,
          messageId: linha.message_id ?? undefined,
          reason: linha.reason,
        });

        const texto = linha.comment_id
          ? await moderationRepository.textOfComment(linha.comment_id)
          : linha.message_id
            ? await moderationRepository.textOfMessage(linha.message_id)
            : null;

        return {
          id: linha.id,
          reason: linha.reason,
          reasonLabel: MOTIVO[linha.reason as ReportReason] ?? linha.reason,
          details: linha.details,
          status: linha.status,
          createdAt: linha.created_at,
          reporter: (linha.profiles as unknown as { username: string } | null)?.username ?? null,
          target: {
            tipo: linha.post_id
              ? ('post' as const)
              : linha.comment_id
                ? ('comentario' as const)
                : linha.message_id
                  ? ('mensagem' as const)
                  : ('perfil' as const),
            id: linha.post_id ?? linha.comment_id ?? linha.message_id ?? linha.profile_id,
            rotulo: alvo.rotulo,
            url: alvo.url,
            texto,
          },
        };
      })
    );
  },

  async pendentes() {
    return { open: await moderationRepository.countOpenReports() };
  },

  async revisar(id: string) {
    const achou = await moderationRepository.reviewReport(id);
    if (!achou) throw AppError.notFound('REPORT_NOT_FOUND', 'Denúncia não encontrada');
    return { id, status: 'reviewed' as const };
  },

  /**
   * Apaga o conteúdo denunciado, sem checar dono — é justamente o que a
   * moderação precisa pular. As denúncias do alvo vão junto (cascade no
   * banco), menos as de mensagem, que só some marcada.
   */
  async apagarConteudo(tipo: 'post' | 'comentario' | 'mensagem', id: string) {
    if (tipo === 'post') {
      // Fotos primeiro, mesma ordem do postsService.remove: apagar a linha
      // antes deixaria os arquivos órfãos no Storage, pagando espaço à toa.
      for (const url of await moderationRepository.mediaUrlsOfPost(id)) {
        const caminho = storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.POSTS, url);
        if (caminho) await storageService.deleteImage(STORAGE_BUCKETS.POSTS, caminho);
      }
      if (!(await moderationRepository.deletePost(id))) {
        throw AppError.notFound('POST_NOT_FOUND', 'Publicação não encontrada');
      }
      return { apagado: true };
    }

    if (tipo === 'comentario') {
      if (!(await moderationRepository.deleteComment(id))) {
        throw AppError.notFound('COMMENT_NOT_FOUND', 'Comentário não encontrado');
      }
      return { apagado: true };
    }

    if (!(await moderationRepository.softDeleteMessage(id))) {
      throw AppError.notFound('MESSAGE_NOT_FOUND', 'Mensagem não encontrada, ou já apagada');
    }
    await moderationRepository.reviewReportsOfMessage(id);
    return { apagado: true };
  },

  ehAdmin(userId: string): Promise<boolean> {
    return moderationRepository.isAdmin(userId);
  },

  /** Ids escondidos deste usuário — usado pelos feeds e listagens. */
  hiddenIdsFor(userId?: string): Promise<string[]> {
    if (!userId) return Promise.resolve([]);
    return moderationRepository.listHiddenIds(userId);
  },
};
