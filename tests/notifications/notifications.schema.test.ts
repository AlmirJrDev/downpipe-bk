import { describe, expect, it } from 'vitest';
import {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
} from '@/modules/notifications/notifications.schema';

describe('notificationIdParamSchema', () => {
  it('aceita um uuid válido', () => {
    expect(
      notificationIdParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success
    ).toBe(true);
  });

  it('rejeita um id que não é uuid', () => {
    expect(notificationIdParamSchema.safeParse({ id: 'nao-e-uuid' }).success).toBe(false);
  });
});

describe('listNotificationsQuerySchema', () => {
  it('aceita query vazia (unreadOnly indefinido)', () => {
    const result = listNotificationsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unreadOnly).toBeUndefined();
    }
  });

  it('transforma "true" em booleano true', () => {
    const result = listNotificationsQuerySchema.safeParse({ unreadOnly: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unreadOnly).toBe(true);
    }
  });

  it('rejeita valores fora de "true"/"false"', () => {
    expect(listNotificationsQuerySchema.safeParse({ unreadOnly: 'yes' }).success).toBe(false);
  });
});
