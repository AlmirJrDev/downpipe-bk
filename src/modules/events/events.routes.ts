import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '@/config/env';
import { sendError } from '@/shared/utils/apiResponse';
import { requireAuth, attachUserIfPresent } from '@/shared/middleware/auth.middleware';
import { imageUpload } from '@/shared/middleware/upload.middleware';
import { getMyTicket, getCheckinList, syncCheckins } from '@/modules/tickets/tickets.controller';
import {
  list,
  listByOrganizer,
  getById,
  create,
  update,
  remove,
  uploadPhoto,
  attend,
  unattend,
  updateAttendanceCar,
  listAttendees,
} from './events.controller';

// Rotas em /events
export const eventsRouter = Router();

// attachUserIfPresent (e não requireAuth): o calendário é público, mas quem
// está logado precisa receber attendingByMe preenchido.
eventsRouter.get('/', attachUserIfPresent, list);
eventsRouter.get('/:id', attachUserIfPresent, getById);
eventsRouter.post('/', requireAuth, create);
eventsRouter.patch('/:id', requireAuth, update);
eventsRouter.delete('/:id', requireAuth, remove);
eventsRouter.post('/:id/photo', requireAuth, imageUpload, uploadPhoto);

// Presença — mesma forma das curtidas: :eventId em vez de :id porque o
// schema do parâmetro é outro.
eventsRouter.post('/:eventId/attend', requireAuth, attend);
eventsRouter.delete('/:eventId/attend', requireAuth, unattend);
eventsRouter.patch('/:eventId/attend/car', requireAuth, updateAttendanceCar);
eventsRouter.get('/:eventId/attendees', listAttendees);

// Ingresso (de quem confirmou) e portaria (de quem organiza). Ainda em
// teste: em produção respondem 404 até INGRESSOS_LIGADOS=1.
const ingressosLigados = (_req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV !== 'production' || env.INGRESSOS_LIGADOS === '1') return next();
  sendError(res, 404, 'NOT_FOUND', 'Ingressos ainda não estão disponíveis.');
};
eventsRouter.get('/:eventId/ticket', ingressosLigados, requireAuth, getMyTicket);
eventsRouter.get('/:eventId/checkin', ingressosLigados, requireAuth, getCheckinList);
eventsRouter.post('/:eventId/checkin', ingressosLigados, requireAuth, syncCheckins);

// Rota em /profiles/:username/events
export const profileEventsRouter = Router();
profileEventsRouter.get('/:username/events', attachUserIfPresent, listByOrganizer);
