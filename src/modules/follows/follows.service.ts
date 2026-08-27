import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';
import { followsRepository, FollowProfileRow } from './follows.repository';

function toPublicFollowProfile(row: FollowProfileRow) {
  return {
    id: row.profiles?.id ?? null,
    username: row.profiles?.username ?? null,
    displayName: row.profiles?.display_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    followedAt: row.created_at,
  };
}

async function assertProfileExists(userId: string) {
  const profile = await profilesRepository.findById(userId);
  if (!profile) {
    throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  }
}

export const followsService = {
  async follow(followerId: string, targetUserId: string) {
    if (followerId === targetUserId) {
      throw AppError.validation('Você não pode seguir a si mesmo');
    }

    await assertProfileExists(targetUserId);

    const alreadyFollowing = await followsRepository.exists(followerId, targetUserId);
    if (alreadyFollowing) {
      throw AppError.conflict('ALREADY_FOLLOWING', 'Você já segue este usuário');
    }

    await followsRepository.create(followerId, targetUserId);
    const followersCount = await followsRepository.countFollowers(targetUserId);

    await notificationsService.notifyFollow(targetUserId, followerId);

    return { isFollowing: true, followersCount };
  },

  async unfollow(followerId: string, targetUserId: string) {
    await assertProfileExists(targetUserId);

    const isFollowing = await followsRepository.exists(followerId, targetUserId);
    if (!isFollowing) {
      throw AppError.notFound('FOLLOW_NOT_FOUND', 'Você ainda não segue este usuário');
    }

    await followsRepository.delete(followerId, targetUserId);
    const followersCount = await followsRepository.countFollowers(targetUserId);

    return { isFollowing: false, followersCount };
  },

  async listFollowers(userId: string, pagination: PaginationParams) {
    await assertProfileExists(userId);
    const { rows, total } = await followsRepository.listFollowers(userId, pagination);
    return { followers: rows.map(toPublicFollowProfile), total };
  },

  async listFollowing(userId: string, pagination: PaginationParams) {
    await assertProfileExists(userId);
    const { rows, total } = await followsRepository.listFollowing(userId, pagination);
    return { following: rows.map(toPublicFollowProfile), total };
  },
};
