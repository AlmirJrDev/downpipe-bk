import { AppError } from '@/shared/utils/AppError';
import { followsRepository } from '@/modules/follows/follows.repository';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { moderationRepository } from './moderation.repository';
import { CreateReportInput } from './moderation.schema';

export const moderationService = {
  async report(reporterId: string, input: CreateReportInput) {
    // Denunciar o próprio perfil não faz sentido e só sujaria a fila.
    if (input.profileId && input.profileId === reporterId) {
      throw AppError.validation('Você não pode denunciar o seu próprio perfil');
    }

    await moderationRepository.createReport(reporterId, input);

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

  /** Ids escondidos deste usuário — usado pelos feeds e listagens. */
  hiddenIdsFor(userId?: string): Promise<string[]> {
    if (!userId) return Promise.resolve([]);
    return moderationRepository.listHiddenIds(userId);
  },
};
