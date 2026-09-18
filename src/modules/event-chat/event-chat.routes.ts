import { Router } from 'express';
import { requireAuth } from '@/shared/middleware/auth.middleware';
import { limiteMensagens } from '@/shared/middleware/rateLimit.middleware';
import { list, send, remove, unread } from './event-chat.controller';

// Rotas em /events/:eventId/chat
export const eventChatRouter = Router();

// Todas exigem login: o chat é só de quem confirmou presença, e isso só dá
// pra saber com a pessoa identificada.
eventChatRouter.get('/:eventId/chat', requireAuth, list);
eventChatRouter.get('/:eventId/chat/unread', requireAuth, unread);
// O limite vem depois do requireAuth porque conta por pessoa, não por rede.
eventChatRouter.post('/:eventId/chat', requireAuth, limiteMensagens, send);
eventChatRouter.delete('/:eventId/chat/:messageId', requireAuth, remove);
