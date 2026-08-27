import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/follows/follows.repository', () => ({
  followsRepository: {
    exists: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    countFollowers: vi.fn(),
    countFollowing: vi.fn(),
    listFollowers: vi.fn(),
    listFollowing: vi.fn(),
    listFollowingIds: vi.fn(),
  },
}));

vi.mock('@/modules/profiles/profiles.repository', () => ({
  profilesRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('@/modules/notifications/notifications.service', () => ({
  notificationsService: {
    notifyFollow: vi.fn(),
  },
}));

import { followsService } from '@/modules/follows/follows.service';
import { followsRepository } from '@/modules/follows/follows.repository';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';

const USER_A = '123e4567-e89b-12d3-a456-426614174000';
const USER_B = '223e4567-e89b-12d3-a456-426614174000';

describe('followsService.follow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita seguir a si mesmo', async () => {
    await expect(followsService.follow(USER_A, USER_A)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(profilesRepository.findById).not.toHaveBeenCalled();
  });

  it('rejeita seguir um perfil inexistente', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(null as never);

    await expect(followsService.follow(USER_A, USER_B)).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('rejeita seguir alguém que já segue', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue({ id: USER_B } as never);
    vi.mocked(followsRepository.exists).mockResolvedValue(true);

    await expect(followsService.follow(USER_A, USER_B)).rejects.toMatchObject({
      code: 'ALREADY_FOLLOWING',
    });
    expect(followsRepository.create).not.toHaveBeenCalled();
  });

  it('cria o follow quando tudo é válido', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue({ id: USER_B } as never);
    vi.mocked(followsRepository.exists).mockResolvedValue(false);
    vi.mocked(followsRepository.countFollowers).mockResolvedValue(5);

    const result = await followsService.follow(USER_A, USER_B);

    expect(followsRepository.create).toHaveBeenCalledWith(USER_A, USER_B);
    expect(notificationsService.notifyFollow).toHaveBeenCalledWith(USER_B, USER_A);
    expect(result).toEqual({ isFollowing: true, followersCount: 5 });
  });
});

describe('followsService.unfollow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita deixar de seguir quem não é seguido', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue({ id: USER_B } as never);
    vi.mocked(followsRepository.exists).mockResolvedValue(false);

    await expect(followsService.unfollow(USER_A, USER_B)).rejects.toMatchObject({
      code: 'FOLLOW_NOT_FOUND',
    });
  });
});
