import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { postsRepository } from '@/modules/posts/posts.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';
import { commentsRepository, CommentRow } from './comments.repository';

function toPublicComment(row: CommentRow) {
  return {
    id: row.id,
    postId: row.post_id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.profiles
      ? {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
        }
      : null,
  };
}

async function findPostOrThrow(postId: string) {
  const post = await postsRepository.findById(postId);
  if (!post) {
    throw AppError.notFound('POST_NOT_FOUND', 'Post não encontrado');
  }
  return post;
}

async function findOwnedCommentById(id: string, userId: string): Promise<CommentRow> {
  const comment = await commentsRepository.findById(id);

  if (!comment) {
    throw AppError.notFound('COMMENT_NOT_FOUND', 'Comentário não encontrado');
  }

  if (comment.author_id !== userId) {
    throw AppError.forbidden('Você só pode gerenciar os seus próprios comentários');
  }

  return comment;
}

export const commentsService = {
  async listByPost(postId: string, pagination: PaginationParams) {
    await findPostOrThrow(postId);
    const { rows, total } = await commentsRepository.listByPost(postId, pagination);
    return { comments: rows.map(toPublicComment), total };
  },

  async create(postId: string, authorId: string, text: string) {
    const post = await findPostOrThrow(postId);
    const id = await commentsRepository.create(postId, authorId, text);
    const comment = await commentsRepository.findById(id);

    await notificationsService.notifyComment(post.author_id, authorId, postId, id);

    return toPublicComment(comment as CommentRow);
  },

  async update(id: string, userId: string, text: string) {
    await findOwnedCommentById(id, userId);
    await commentsRepository.update(id, text);
    const updated = await commentsRepository.findById(id);
    return toPublicComment(updated as CommentRow);
  },

  async remove(id: string, userId: string) {
    await findOwnedCommentById(id, userId);
    await commentsRepository.delete(id);
  },
};
