import { describe, expect, it } from 'vitest';
import { postIdParamSchema } from '@/modules/likes/likes.schema';

describe('postIdParamSchema', () => {
  it('aceita um uuid válido', () => {
    expect(postIdParamSchema.safeParse({ postId: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(
      true
    );
  });

  it('rejeita um id que não é uuid', () => {
    expect(postIdParamSchema.safeParse({ postId: 'nao-e-uuid' }).success).toBe(false);
  });
});
