import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/profiles/profiles.repository', () => ({
  profilesRepository: { sugestoes: vi.fn(), findById: vi.fn(), getPublicCounts: vi.fn() },
}));

vi.mock('@/modules/follows/follows.repository', () => ({
  followsRepository: { listFollowingIds: vi.fn() },
}));

vi.mock('@/modules/moderation/moderation.repository', () => ({
  moderationRepository: { listHiddenIds: vi.fn(), isAdmin: vi.fn() },
}));

vi.mock('@/shared/storage/storage.service', () => ({ storageService: {} }));
vi.mock('@/config/supabase', () => ({ supabaseAdmin: {} }));

import { profilesService } from '@/modules/profiles/profiles.service';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { followsRepository } from '@/modules/follows/follows.repository';
import { moderationRepository } from '@/modules/moderation/moderation.repository';

const EU = 'eu';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(profilesRepository.sugestoes).mockResolvedValue([]);
  vi.mocked(followsRepository.listFollowingIds).mockResolvedValue([]);
  vi.mocked(moderationRepository.listHiddenIds).mockResolvedValue([]);
});

describe('quem seguir', () => {
  it('não sugere eu mesmo, quem eu já sigo nem quem eu bloqueei', async () => {
    vi.mocked(followsRepository.listFollowingIds).mockResolvedValue(['ja-sigo']);
    vi.mocked(moderationRepository.listHiddenIds).mockResolvedValue(['bloqueado']);

    await profilesService.sugestoes(EU, 8);

    const [excluidos, limite] = vi.mocked(profilesRepository.sugestoes).mock.calls[0];
    expect(excluidos.sort()).toEqual(['bloqueado', 'eu', 'ja-sigo']);
    expect(limite).toBe(8);
  });

  it('id repetido (sigo e bloqueei a mesma pessoa) entra uma vez só', async () => {
    vi.mocked(followsRepository.listFollowingIds).mockResolvedValue(['x']);
    vi.mocked(moderationRepository.listHiddenIds).mockResolvedValue(['x']);

    await profilesService.sugestoes(EU, 8);

    const [excluidos] = vi.mocked(profilesRepository.sugestoes).mock.calls[0];
    expect(excluidos.filter((id) => id === 'x')).toHaveLength(1);
  });

  it('devolve o perfil no formato do app', async () => {
    vi.mocked(profilesRepository.sugestoes).mockResolvedValue([
      {
        id: 'p1',
        username: 'joaos0ares',
        display_name: 'João',
        avatar_url: null,
        bio: 'Classe A de rua',
        is_organizer: true,
        cars_count: 2,
        posts_count: 9,
        last_post_at: '2026-09-20T12:00:00Z',
      },
    ]);

    const [sugestao] = await profilesService.sugestoes(EU, 8);

    expect(sugestao).toEqual({
      id: 'p1',
      username: 'joaos0ares',
      displayName: 'João',
      avatarUrl: null,
      bio: 'Classe A de rua',
      isOrganizer: true,
      carsCount: 2,
      postsCount: 9,
    });
  });
});
