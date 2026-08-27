import { describe, expect, it } from 'vitest';
import { updateProfileSchema, usernameSchema } from '@/modules/profiles/profiles.schema';

describe('usernameSchema', () => {
  it('aceita usernames válidos', () => {
    expect(usernameSchema.safeParse('gearhead_01').success).toBe(true);
  });

  it('rejeita usernames com maiúsculas ou espaços', () => {
    expect(usernameSchema.safeParse('Gear Head').success).toBe(false);
  });

  it('rejeita usernames muito curtos', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('aceita atualização parcial válida', () => {
    const result = updateProfileSchema.safeParse({ bio: 'Fã de JDM' });
    expect(result.success).toBe(true);
  });

  it('rejeita tentativa de alterar o id diretamente', () => {
    const result = updateProfileSchema.safeParse({ id: 'algum-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejeita bio maior que 300 caracteres', () => {
    const result = updateProfileSchema.safeParse({ bio: 'a'.repeat(301) });
    expect(result.success).toBe(false);
  });
});
