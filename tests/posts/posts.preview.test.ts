import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/posts/posts.repository', () => ({
  postsRepository: {
    list: vi.fn(),
    findLikedPostIds: vi.fn(),
    findSavedPostIds: vi.fn(),
    findCommentPreviews: vi.fn(),
  },
}));

vi.mock('@/modules/moderation/moderation.service', () => ({
  moderationService: { hiddenIdsFor: vi.fn() },
}));

import { postsService } from '@/modules/posts/posts.service';
import { postsRepository } from '@/modules/posts/posts.repository';
import { moderationService } from '@/modules/moderation/moderation.service';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const BLOQUEADO = '22222222-2222-4222-8222-222222222222';
const OUTRO = '33333333-3333-4333-8333-333333333333';
const POST = '44444444-4444-4444-8444-444444444444';

function comentario(autor: string, texto: string, minuto: number) {
  return {
    id: `c-${minuto}`,
    post_id: POST,
    author_id: autor,
    text: texto,
    created_at: `2026-09-18T12:${String(minuto).padStart(2, '0')}:00Z`,
    username: autor === BLOQUEADO ? 'chato' : 'fulano',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(postsRepository.list).mockResolvedValue({
    rows: [{ id: POST, post_media: [], post_likes: [], comments: [{ count: 3 }] } as never],
    total: 1,
  });
  vi.mocked(postsRepository.findLikedPostIds).mockResolvedValue(new Set());
  vi.mocked(postsRepository.findSavedPostIds).mockResolvedValue(new Set());
});

describe('prévia de comentários no card', () => {
  it('mostra os 2 mais recentes, o mais novo por último', async () => {
    vi.mocked(moderationService.hiddenIdsFor).mockResolvedValue([]);
    vi.mocked(postsRepository.findCommentPreviews).mockResolvedValue(
      new Map([[POST, [comentario(OUTRO, 'primeiro', 1), comentario(OUTRO, 'segundo', 2), comentario(OUTRO, 'terceiro', 3)]]])
    );

    const { posts } = await postsService.list({}, { page: 1, limit: 20, offset: 0 }, VIEWER);

    expect(posts[0].commentsPreview.map((c) => c.text)).toEqual(['segundo', 'terceiro']);
  });

  it('pula quem a pessoa bloqueou e completa com o comentário anterior', async () => {
    vi.mocked(moderationService.hiddenIdsFor).mockResolvedValue([BLOQUEADO]);
    vi.mocked(postsRepository.findCommentPreviews).mockResolvedValue(
      new Map([
        [POST, [comentario(OUTRO, 'primeiro', 1), comentario(OUTRO, 'segundo', 2), comentario(BLOQUEADO, 'ofensa', 3)]],
      ])
    );

    const { posts } = await postsService.list({}, { page: 1, limit: 20, offset: 0 }, VIEWER);

    expect(posts[0].commentsPreview.map((c) => c.text)).toEqual(['primeiro', 'segundo']);
  });

  it('post sem comentário vem com prévia vazia, não sem o campo', async () => {
    vi.mocked(moderationService.hiddenIdsFor).mockResolvedValue([]);
    vi.mocked(postsRepository.findCommentPreviews).mockResolvedValue(new Map());

    const { posts } = await postsService.list({}, { page: 1, limit: 20, offset: 0 }, undefined);

    expect(posts[0].commentsPreview).toEqual([]);
  });
});
