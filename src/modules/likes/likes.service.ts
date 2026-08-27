import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { postsRepository } from '@/modules/posts/posts.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';
import { likesRepository } from './likes.repository';

async function findPostOrThrow(postId: string) {
  const post = await postsRepository.findById(postId);
  if (!post) {
    throw AppError.notFound('POST_NOT_FOUND', 'Post não encontrado');
  }
  return post;
}

export const likesService = {
  async like(postId: string, userId: string) {
    const post = await findPostOrThrow(postId);

    const alreadyLiked = await likesRepository.exists(postId, userId);
    if (alreadyLiked) {
      throw AppError.conflict('ALREADY_LIKED', 'Você já curtiu este post');
    }

    await likesRepository.create(postId, userId);
    const likesCount = await likesRepository.count(postId);

    await notificationsService.notifyLike(post.author_id, userId, postId);

    return { likesCount, likedByMe: true };
  },

  async unlike(postId: string, userId: string) {
    await findPostOrThrow(postId);

    const alreadyLiked = await likesRepository.exists(postId, userId);
    if (!alreadyLiked) {
      throw AppError.notFound('LIKE_NOT_FOUND', 'Você ainda não curtiu este post');
    }

    await likesRepository.delete(postId, userId);
    const likesCount = await likesRepository.count(postId);

    return { likesCount, likedByMe: false };
  },

  async listLikers(postId: string, pagination: PaginationParams) {
    await findPostOrThrow(postId);

    const { rows, total } = await likesRepository.listLikers(postId, pagination);

    return {
      likers: rows.map((row) => ({
        userId: row.user_id,
        likedAt: row.created_at,
        username: row.profiles?.username ?? null,
        displayName: row.profiles?.display_name ?? null,
        avatarUrl: row.profiles?.avatar_url ?? null,
      })),
      total,
    };
  },
};
