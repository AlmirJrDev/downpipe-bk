import { Router } from 'express';
import { requireAuth, attachUserIfPresent } from '@/shared/middleware/auth.middleware';
import { imageUpload } from '@/shared/middleware/upload.middleware';
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

// Rota em /profiles/:username/events
export const profileEventsRouter = Router();
profileEventsRouter.get('/:username/events', attachUserIfPresent, listByOrganizer);
