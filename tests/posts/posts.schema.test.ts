import { describe, expect, it } from 'vitest';
import { createPostSchema, updatePostSchema } from '@/modules/posts/posts.schema';

describe('createPostSchema', () => {
  it('aceita um payload mínimo vazio (todos os campos são opcionais)', () => {
    expect(createPostSchema.safeParse({}).success).toBe(true);
  });

  it('aceita um payload completo válido', () => {
    const result = createPostSchema.safeParse({
      carId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'evolution',
      title: 'Antes e depois',
      subtitle: 'Projeto Stage 2',
      caption: 'Depois de 6 meses de trabalho',
      cost: 15000,
      progressPercent: 80,
    });
    expect(result.success).toBe(true);
  });

  it('coage strings numéricas vindas de multipart/form-data', () => {
    const result = createPostSchema.safeParse({ cost: '1500.50', progressPercent: '75' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cost).toBe(1500.5);
      expect(result.data.progressPercent).toBe(75);
    }
  });

  it('rejeita type fora do enum', () => {
    expect(createPostSchema.safeParse({ type: 'story' }).success).toBe(false);
  });

  it('rejeita progressPercent fora do intervalo 0-100', () => {
    expect(createPostSchema.safeParse({ progressPercent: 150 }).success).toBe(false);
  });
});

describe('updatePostSchema', () => {
  it('rejeita objeto vazio', () => {
    expect(updatePostSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial válida', () => {
    expect(updatePostSchema.safeParse({ caption: 'Legenda atualizada' }).success).toBe(true);
  });

  it('rejeita tentativa de trocar o carId na edição (campo não existe no schema)', () => {
    const result = updatePostSchema.safeParse({
      caption: 'X',
      carId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(false);
  });
});
