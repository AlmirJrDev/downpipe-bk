import { describe, expect, it } from 'vitest';
import { extensionForMimeType, STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { storageService } from '@/shared/storage/storage.service';

describe('extensionForMimeType', () => {
  it('mapeia mime types conhecidos para a extensão correta', () => {
    expect(extensionForMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForMimeType('image/png')).toBe('png');
    expect(extensionForMimeType('image/webp')).toBe('webp');
  });

  it('usa "bin" como fallback para mime types desconhecidos', () => {
    expect(extensionForMimeType('application/octet-stream')).toBe('bin');
  });
});

describe('storageService.extractPathFromPublicUrl', () => {
  it('extrai o path relativo ao bucket de uma URL pública válida', () => {
    const url =
      'https://xyzcompany.supabase.co/storage/v1/object/public/cars/user-123/photo.jpg';
    expect(storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.CARS, url)).toBe(
      'user-123/photo.jpg'
    );
  });

  it('retorna null quando a URL não pertence ao bucket informado', () => {
    const url =
      'https://xyzcompany.supabase.co/storage/v1/object/public/avatars/user-123/photo.jpg';
    expect(storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.CARS, url)).toBeNull();
  });

  it('retorna null para uma URL que não é do Supabase Storage', () => {
    expect(
      storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.CARS, 'https://cdn.example.com/x.jpg')
    ).toBeNull();
  });
});
