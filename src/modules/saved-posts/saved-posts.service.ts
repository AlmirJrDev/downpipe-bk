import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { postsRepository } from '@/modules/posts/posts.repository';
import { postsService } from '@/modules/posts/posts.service';
import { savedPostsRepository } from './saved-posts.repository';

async function findPostOrThrow(postId: string) {
  const post = await postsRepository.findById(postId);
  if (!post) {
    throw AppError.notFound('POST_NOT_FOUND', 'Post não encontrado');
  }
  return post;
}

export const savedPostsService = {
  async save(postId: string, userId: string) {
    await findPostOrThrow(postId);

    const already = await savedPostsRepository.exists(postId, userId);
    if (already) {
      throw AppError.conflict('ALREADY_SAVED', 'Você já salvou este post');
    }

    await savedPostsRepository.create(postId, userId);

    // Salvar é privado: não notifica o autor do post, ao contrário da
    // curtida. Ninguém precisa saber que foi guardado.
    return { savedByMe: true };
  },

  async unsave(postId: string, userId: string) {
    await findPostOrThrow(postId);

    const saved = await savedPostsRepository.exists(postId, userId);
    if (!saved) {
      throw AppError.notFound('SAVE_NOT_FOUND', 'Você ainda não salvou este post');
    }

    await savedPostsRepository.delete(postId, userId);
    return { savedByMe: false };
  },

  async listSaved(userId: string, pagination: PaginationParams) {
    const { ids, total } = await savedPostsRepository.listSavedPostIds(userId, pagination);

    if (ids.length === 0) return { posts: [], total };

    // A paginação já aconteceu em saved_posts; aqui é só hidratar os posts
    // desses ids, então limit/offset são fixos no tamanho da página.
    const { posts } = await postsService.list(
      { idIn: ids },
      { page: 1, limit: ids.length, offset: 0 },
      userId
    );

    // postsService.list devolve por data de publicação; a lista de salvos é
    // ordenada por quando foi salvo, então reordena pelos ids originais.
    const byId = new Map(posts.map((post) => [post.id, post]));
    return { posts: ids.map((id) => byId.get(id)).filter(Boolean), total };
  },
};
