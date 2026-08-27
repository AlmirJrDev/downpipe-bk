import { describe, expect, it } from 'vitest';
import { createCommentSchema, updateCommentSchema } from '@/modules/comments/comments.schema';

describe('createCommentSchema', () => {
  it('exige text', () => {
    expect(createCommentSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita text vazio', () => {
    expect(createCommentSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('aceita um comentário válido', () => {
    expect(createCommentSchema.safeParse({ text: 'Muito bom esse projeto!' }).success).toBe(true);
  });

  it('rejeita texto acima de 1000 caracteres', () => {
    expect(createCommentSchema.safeParse({ text: 'a'.repeat(1001) }).success).toBe(false);
  });
});

describe('updateCommentSchema', () => {
  it('exige text não vazio', () => {
    expect(updateCommentSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('aceita atualização válida', () => {
    expect(updateCommentSchema.safeParse({ text: 'Editado' }).success).toBe(true);
  });
});
