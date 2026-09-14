import { AppError } from '@/shared/utils/AppError';
import { supabaseAdmin } from '@/config/supabase';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { followsRepository } from '@/modules/follows/follows.repository';
import { profilesRepository, ProfileRow } from './profiles.repository';
import { UpdateProfileInput } from './profiles.schema';

function toPublicProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    gearheadSince: row.gearhead_since,
    isOrganizer: row.is_organizer,
    createdAt: row.created_at,
  };
}

export const profilesService = {
  async getMe(userId: string) {
    const profile = await profilesRepository.findById(userId);

    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    // Mesmos contadores do perfil público: sem eles o app mostrava
    // "0 projetos / 0 seguidores" na própria tela de perfil, já que é daqui
    // que ele lê os dados do usuário logado.
    const counts = await profilesRepository.getPublicCounts(profile.id);

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      gearheadSince: profile.gearhead_since,
      isOrganizer: profile.is_organizer,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
      carsCount: counts.carsCount,
      projectsCount: counts.projectsCount,
      eventsAttendedCount: counts.eventsAttendedCount,
    };
  },

  async updateMe(userId: string, input: UpdateProfileInput) {
    if (input.username) {
      const taken = await profilesRepository.isUsernameTaken(input.username, userId);
      if (taken) {
        throw AppError.conflict('USERNAME_TAKEN', 'Este username já está em uso');
      }
    }

    const updated = await profilesRepository.update(userId, input);

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.display_name,
      bio: updated.bio,
      avatarUrl: updated.avatar_url,
      gearheadSince: updated.gearhead_since,
      isOrganizer: updated.is_organizer,
      updatedAt: updated.updated_at,
    };
  },

  /**
   * Exclui a conta e tudo o que veio com ela.
   *
   * `confirmUsername` é o @ que a pessoa digitou na tela de confirmação. É
   * irreversível, então o servidor confere de novo em vez de confiar só no
   * app: um pedido disparado por engano, ou de uma versão velha do app, não
   * apaga nada.
   *
   * A ordem importa. Fotos primeiro, conta depois: se o Storage falhar, a
   * conta continua de pé e a pessoa pode tentar de novo. Na ordem inversa,
   * uma falha deixaria fotos públicas de uma conta que não existe mais.
   *
   * O banco cuida do resto sozinho. Apagar o usuário do Auth apaga o perfil
   * (profiles.id referencia auth.users com cascade), e o perfil leva carros,
   * posts, comentários, curtidas, follows, rolês, presenças, notificações,
   * salvos, bloqueios e inscrições de push. Posts de outras pessoas que
   * marcaram um carro desta conta ficam, só perdem a marcação — a foto é de
   * quem fotografou, como a política de privacidade avisa.
   */
  async deleteMe(userId: string, confirmUsername: string) {
    const profile = await profilesRepository.findById(userId);
    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    if (profile.username !== confirmUsername) {
      throw AppError.validation('O @ digitado não confere com o da sua conta.');
    }

    for (const bucket of Object.values(STORAGE_BUCKETS)) {
      await storageService.deleteUserFolder(bucket, userId);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      throw AppError.internal(`Falha ao excluir a conta: ${error.message}`);
    }
  },

  async getPublicProfile(username: string, viewerId: string | undefined) {
    const profile = await profilesRepository.findByUsername(username);

    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    const counts = await profilesRepository.getPublicCounts(profile.id);

    const isFollowing =
      viewerId && viewerId !== profile.id
        ? await followsRepository.exists(viewerId, profile.id)
        : viewerId
          ? false // o próprio dono do perfil nunca "segue a si mesmo"
          : null;

    return {
      ...toPublicProfile(profile),
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
      carsCount: counts.carsCount,
      projectsCount: counts.projectsCount,
      eventsAttendedCount: counts.eventsAttendedCount,
      isFollowing,
    };
  },
};
