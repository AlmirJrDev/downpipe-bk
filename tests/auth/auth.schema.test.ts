import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from '@/modules/auth/auth.schema';

describe('registerSchema', () => {
  it('aceita cadastro válido', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'senha1234',
      displayName: 'Almir',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita senha curta', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const result = registerSchema.safeParse({
      email: 'nao-e-um-email',
      password: 'senha1234',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('exige senha não vazia', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});
