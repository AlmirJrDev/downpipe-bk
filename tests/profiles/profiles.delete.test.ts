import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/modules/profiles/profiles.repository', () => ({
  profilesRepository: { findById: vi.fn() },
}));

vi.mock('@/shared/storage/storage.service', () => ({
  storageService: { deleteUserFolder: vi.fn() },
}));

vi.mock('@/config/supabase', () => ({
  supabaseAdmin: { auth: { admin: { deleteUser: vi.fn() } } },
}));

import { profilesService } from '@/modules/profiles/profiles.service';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { storageService } from '@/shared/storage/storage.service';
import { supabaseAdmin } from '@/config/supabase';

const USER = '123e4567-e89b-12d3-a456-426614174000';

function perfil(username: string) {
  return { id: USER, username } as Awaited<ReturnType<typeof profilesRepository.findById>>;
}

describe('profilesService.deleteMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageService.deleteUserFolder).mockResolvedValue(0);
    vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
  });

  it('apaga as fotos dos três buckets e depois a conta', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(perfil('almeida'));

    await profilesService.deleteMe(USER, 'almeida');

    const buckets = vi.mocked(storageService.deleteUserFolder).mock.calls.map(([b]) => b);
    expect(buckets.sort()).toEqual(['avatars', 'cars', 'posts']);
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(USER);

    // Fotos antes da conta: a última remoção de Storage vem antes da exclusão.
    const ultimaFoto = Math.max(...vi.mocked(storageService.deleteUserFolder).mock.invocationCallOrder);
    const conta = vi.mocked(supabaseAdmin.auth.admin.deleteUser).mock.invocationCallOrder[0];
    expect(ultimaFoto).toBeLessThan(conta);
  });

  it('não apaga nada quando o @ digitado não confere', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(perfil('almeida'));

    await expect(profilesService.deleteMe(USER, 'outra.pessoa')).rejects.toMatchObject({
      statusCode: 422,
    });

    expect(storageService.deleteUserFolder).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('mantém a conta quando a remoção das fotos falha', async () => {
    vi.mocked(profilesRepository.findById).mockResolvedValue(perfil('almeida'));
    vi.mocked(storageService.deleteUserFolder).mockRejectedValue(new Error('storage fora'));

    await expect(profilesService.deleteMe(USER, 'almeida')).rejects.toThrow('storage fora');

    expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});
