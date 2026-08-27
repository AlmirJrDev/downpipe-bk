import { describe, expect, it } from 'vitest';
import { userIdParamSchema } from '@/modules/follows/follows.schema';

describe('userIdParamSchema', () => {
  it('aceita um uuid válido', () => {
    expect(userIdParamSchema.safeParse({ userId: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(
      true
    );
  });

  it('rejeita um id que não é uuid', () => {
    expect(userIdParamSchema.safeParse({ userId: 'nao-e-uuid' }).success).toBe(false);
  });
});
