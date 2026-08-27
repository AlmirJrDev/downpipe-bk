import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('id inválido'),
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
