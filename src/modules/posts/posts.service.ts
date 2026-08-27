import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { carsRepository } from '@/modules/cars/cars.repository';
import { followsRepository } from '@/modules/follows/follows.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';
import { postsRepository, PostRow } from './posts.repository';
import { CreatePostInput, UpdatePostInput } from './posts.schema';

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

function toPublicPost(row: PostRow, likedByMe: boolean | null, savedByMe: boolean | null) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    caption: row.caption,
    cost: row.cost,
    progressPercent: row.progress_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.profiles
      ? {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
        }
      : null,
    car: row.cars
      ? {
          id: row.cars.id,
          version: row.cars.version,
          photoUrl: row.cars.photo_url,
          vehicle: row.cars.vehicle_versions
            ? {
                name: row.cars.vehicle_versions.name,
                year: row.cars.vehicle_versions.year,
                model: row.cars.vehicle_versions.vehicle_models.name,
                brand: row.cars.vehicle_versions.vehicle_models.vehicle_brands.name,
              }
            : null,
        }
      : null,
    media: (row.post_media ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, mediaUrl: m.media_url, mediaType: m.media_type, position: m.position })),
    likesCount: row.post_likes?.[0]?.count ?? 0,
    commentsCount: row.comments?.[0]?.count ?? 0,
    likedByMe,
    savedByMe,
  };
}

async function assertPostOwnership(postId: string, userId: string): Promise<PostRow> {
  const post = await postsRepository.findById(postId);

  if (!post) {
    throw AppError.notFound('POST_NOT_FOUND', 'Post não encontrado');
  }

  if (post.author_id !== userId) {
    throw AppError.forbidden('Você só pode gerenciar os seus próprios posts');
  }

  return post;
}

async function buildPostsResponse(rows: PostRow[], total: number, viewerId: string | undefined) {
  let likedSet = new Set<string>();
  let savedSet = new Set<string>();

  if (viewerId && rows.length > 0) {
    const ids = rows.map((row) => row.id);
    // Duas consultas independentes: em paralelo, não em sequência.
    [likedSet, savedSet] = await Promise.all([
      postsRepository.findLikedPostIds(ids, viewerId),
      postsRepository.findSavedPostIds(ids, viewerId),
    ]);
  }

  return {
    posts: rows.map((row) =>
      toPublicPost(
        row,
        viewerId ? likedSet.has(row.id) : null,
        viewerId ? savedSet.has(row.id) : null
      )
    ),
    total,
  };
}

export const postsService = {
  async list(
    filters: { authorId?: string; carId?: string; idIn?: string[] },
    pagination: PaginationParams,
    viewerId?: string
  ) {
    const { rows, total } = await postsRepository.list(filters, pagination);
    return buildPostsResponse(rows, total, viewerId);
  },

  /**
   * Feed (Fase 6): na primeira página, se o usuário autenticado segue
   * alguém, prioriza posts recentes de quem ele segue e completa o
   * restante da página com posts recentes em geral (sem duplicar). A
   * prioridade vale pra decidir QUAIS posts entram na página; o que é
   * exibido sai sempre em ordem cronológica (mais recente primeiro).
   * Deliberadamente simples (sem ranking/algoritmo de recomendação),
   * conforme a especificação. Da segunda página em diante, cai para a
   * ordenação padrão por recência — manter a mesma mistura em páginas
   * subsequentes exigiria um cursor mais sofisticado, fora do escopo do MVP.
   */
  async getFeed(pagination: PaginationParams, viewerId?: string) {
    if (viewerId && pagination.page === 1) {
      const followingIds = await followsRepository.listFollowingIds(viewerId);

      if (followingIds.length > 0) {
        const followed = await postsRepository.list(
          { authorIdIn: followingIds },
          { ...pagination, offset: 0 }
        );

        if (followed.rows.length >= pagination.limit) {
          return buildPostsResponse(followed.rows.slice(0, pagination.limit), followed.total, viewerId);
        }

        const remaining = pagination.limit - followed.rows.length;
        const recent = await postsRepository.list(
          { excludeIds: followed.rows.map((row) => row.id) },
          { limit: remaining, offset: 0, page: 1 }
        );

        // Reordena por data depois de juntar: quem o usuário segue continua
        // tendo prioridade na ESCOLHA dos posts da primeira página, mas a
        // ORDEM mostrada é cronológica. Sem isto, concatenar os dois grupos
        // colocava um post antigo de quem se segue acima de um post novo de
        // outra pessoa, e o feed não começava pelo mais recente.
        const combinedRows = [...followed.rows, ...recent.rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const overallTotal = await postsRepository.countAll();

        return buildPostsResponse(combinedRows, overallTotal, viewerId);
      }
    }

    return this.list({}, pagination, viewerId);
  },

  async listByUsername(username: string, pagination: PaginationParams, viewerId?: string) {
    const profile = await profilesRepository.findByUsername(username);

    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    return this.list({ authorId: profile.id }, pagination, viewerId);
  },

  async listByCar(carId: string, pagination: PaginationParams, viewerId?: string) {
    const car = await carsRepository.findById(carId);

    if (!car) {
      throw AppError.notFound('CAR_NOT_FOUND', 'Carro não encontrado');
    }

    return this.list({ carId }, pagination, viewerId);
  },

  async getById(id: string, viewerId?: string) {
    const post = await postsRepository.findById(id);

    if (!post) {
      throw AppError.notFound('POST_NOT_FOUND', 'Post não encontrado');
    }

    const [likedByMe, savedByMe] = viewerId
      ? await Promise.all([
          postsRepository.findLikedPostIds([id], viewerId).then((set) => set.has(id)),
          postsRepository.findSavedPostIds([id], viewerId).then((set) => set.has(id)),
        ])
      : [null, null];

    return toPublicPost(post, likedByMe, savedByMe);
  },

  async create(authorId: string, input: CreatePostInput, files: UploadedFile[]) {
    if (input.carId) {
      await assertCarOwnership(input.carId, authorId);
    }

    const postId = await postsRepository.create(authorId, input);

    if (files.length > 0) {
      const uploaded = await Promise.all(
        files.map((file) =>
          storageService.uploadImage({
            bucket: STORAGE_BUCKETS.POSTS,
            userId: authorId,
            buffer: file.buffer,
            mimeType: file.mimetype,
          })
        )
      );

      await postsRepository.insertMedia(
        postId,
        uploaded.map((item, index) => ({
          mediaUrl: item.publicUrl,
          mediaType: 'image' as const,
          position: index,
        }))
      );
    }

    const post = await postsRepository.findById(postId);

    // Notifica os seguidores do autor quando o post é uma atualização de
    // projeto (fan-out simples, sem fila/job assíncrono - aceitável para o
    // volume esperado de um MVP).
    if (input.type === 'project_update') {
      const followerIds = await followsRepository.listFollowerIds(authorId);
      await notificationsService.notifyProjectUpdate(followerIds, authorId, postId);
    }

    // Post recém-criado: ninguém curtiu nem salvou ainda, nem o autor.
    return toPublicPost(post as PostRow, false, false);
  },

  async update(id: string, userId: string, input: UpdatePostInput) {
    await assertPostOwnership(id, userId);
    await postsRepository.update(id, input);
    const updated = await postsRepository.findById(id);
    const [likedByMe, savedByMe] = await Promise.all([
      postsRepository.findLikedPostIds([id], userId).then((set) => set.has(id)),
      postsRepository.findSavedPostIds([id], userId).then((set) => set.has(id)),
    ]);
    return toPublicPost(updated as PostRow, likedByMe, savedByMe);
  },

  async remove(id: string, userId: string) {
    const post = await assertPostOwnership(id, userId);

    // Remove as mídias do Storage (best-effort) antes de apagar o post
    // (o delete em cascata do banco já remove as linhas de post_media).
    for (const media of post.post_media ?? []) {
      const path = storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.POSTS, media.media_url);
      if (path) {
        await storageService.deleteImage(STORAGE_BUCKETS.POSTS, path);
      }
    }

    await postsRepository.delete(id);
  },
};
