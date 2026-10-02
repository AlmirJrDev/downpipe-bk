import { AppError } from '@/shared/utils/AppError';
import { eventsRepository } from '@/modules/events/events.repository';
import { ticketsRepository, TicketRow } from './tickets.repository';
import { SyncCheckinsInput } from './tickets.schema';

/** "VW Gol 1994" — o que a portaria confere junto com o rosto. */
export function rotuloDoCarro(cars: TicketRow['cars']): string | null {
  if (!cars) return null;
  const v = cars.vehicle_versions;
  if (v) return `${v.vehicle_models.vehicle_brands.name} ${v.vehicle_models.name} ${v.year}`;
  return cars.version?.trim() || null;
}

/**
 * Hora da entrada que vai pro banco. O relógio do celular da portaria é o
 * que se tem (offline não há outro), mas um relógio adiantado não pode
 * registrar entrada no futuro.
 */
export function horaDaEntrada(at: string, agora = new Date()): string {
  const quando = new Date(at);
  return quando.getTime() > agora.getTime() ? agora.toISOString() : quando.toISOString();
}

function toTicket(row: TicketRow) {
  const nome = row.profiles?.display_name?.trim() || row.profiles?.username || 'Sem nome';
  return {
    eventId: row.event_id,
    code: row.ticket_code,
    holderName: nome,
    holderUsername: row.profiles?.username ?? null,
    carLabel: rotuloDoCarro(row.cars),
    checkedInAt: row.checked_in_at,
  };
}

function toCheckinEntry(row: TicketRow) {
  return {
    code: row.ticket_code,
    userId: row.user_id,
    username: row.profiles?.username ?? null,
    displayName: row.profiles?.display_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    carLabel: rotuloDoCarro(row.cars),
    checkedInAt: row.checked_in_at,
  };
}

async function assertOrganizador(eventId: string, userId: string) {
  const event = await eventsRepository.findById(eventId);
  if (!event) throw AppError.notFound('EVENT_NOT_FOUND', 'Evento não encontrado');
  if (event.organizer_id !== userId) {
    throw AppError.forbidden('A portaria é só de quem organiza o rolê');
  }
}

async function montarLista(eventId: string) {
  // generatedAt sai ANTES da leitura: uma entrada gravada enquanto a lista
  // é montada fica com hora posterior, e nunca parece "mais velha" que ela.
  const generatedAt = new Date().toISOString();
  const rows = await ticketsRepository.listByEvent(eventId);
  return { eventId, generatedAt, entries: rows.map(toCheckinEntry) };
}

export const ticketsService = {
  /** O ingresso de quem pede. 404 = não confirmou presença. */
  async getMine(eventId: string, userId: string) {
    const row = await ticketsRepository.findByAttendee(eventId, userId);
    if (!row) {
      throw AppError.notFound('TICKET_NOT_FOUND', 'Confirme presença no rolê para ter ingresso');
    }
    return toTicket(row);
  },

  /** A lista inteira, pra portaria validar sem internet. */
  async getCheckinList(eventId: string, userId: string) {
    await assertOrganizador(eventId, userId);
    return montarLista(eventId);
  },

  /**
   * Entradas feitas na portaria, em lote. Devolve a lista atualizada: é ela
   * que conta a um portão quem entrou pelo outro.
   */
  async sync(eventId: string, userId: string, input: SyncCheckinsInput) {
    await assertOrganizador(eventId, userId);

    const agora = new Date();
    for (const item of input.checkins) {
      await ticketsRepository.registrarEntrada(
        eventId,
        item.code,
        horaDaEntrada(item.at, agora),
        item.deviceId
      );
    }

    return montarLista(eventId);
  },
};
