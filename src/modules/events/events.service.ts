import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { followsRepository } from '@/modules/follows/follows.repository';
import { notificationsService } from '@/modules/notifications/notifications.service';
import { geocodingService } from '@/shared/geocoding/geocoding.service';
import { distanceKm, boundingBox } from '@/shared/geocoding/distance';
import { eventsRepository, EventRow, AttendeeRow } from './events.repository';
import { CreateEventInput, UpdateEventInput } from './events.schema';

function toPublicEvent(
  row: EventRow,
  attendingByMe: boolean | null,
  friendsGoing: number | null = null
) {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    description: row.description,
    startsAt: row.starts_at,
    location: row.location,
    city: row.city,
    address: row.address,
    photoUrl: row.photo_url,
    visibility: row.visibility,
    latitude: row.latitude,
    longitude: row.longitude,
    // "city" avisa a tela que o pino é o centro da cidade, não o local do
    // rolê — sem isso ela mostraria um ponto aproximado como se fosse exato.
    coordsPrecision: row.coords_precision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organizer: row.profiles
      ? {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
          isOrganizer: row.profiles.is_organizer,
        }
      : null,
    attendeesCount: row.event_attendees?.[0]?.count ?? 0,
    attendingByMe,
    // Quantos dos confirmados o usuário segue. null pra quem não está
    // logado — sem seguir ninguém, o número não significa nada.
    friendsGoing,
  };
}

function toPublicAttendee(row: AttendeeRow) {
  return {
    userId: row.user_id,
    confirmedAt: row.created_at,
    username: row.profiles?.username ?? null,
    displayName: row.profiles?.display_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    // Carro que a pessoa vai levar. Null é o caso comum: carona, a pé, ou
    // quem vai justamente pra fotografar o carro dos outros.
    car: row.cars
      ? {
          id: row.cars.id,
          version: row.cars.version,
          photoUrl: row.cars.photo_url,
          vehicle: row.cars.vehicle_versions
            ? {
                name: row.cars.vehicle_versions.name,
                year: row.cars.vehicle_versions.year,
                model: row.cars.vehicle_versions.vehicle_models.name,
                brand: row.cars.vehicle_versions.vehicle_models.vehicle_brands.name,
              }
            : null,
        }
      : null,
  };
}

async function findEventOrThrow(id: string): Promise<EventRow> {
  const event = await eventsRepository.findById(id);
  if (!event) {
    throw AppError.notFound('EVENT_NOT_FOUND', 'Evento não encontrado');
  }
  return event;
}

async function assertOrganizer(id: string, userId: string): Promise<EventRow> {
  const event = await findEventOrThrow(id);
  if (event.organizer_id !== userId) {
    throw AppError.forbidden('Você só pode gerenciar os eventos que organiza');
  }
  return event;
}

/**
 * Define as coordenadas do evento.
 *
 * Se o organizador escolheu o ponto (pino, GPS ou sugestão de endereço),
 * usa aquilo e marca 'pinned' — ninguém sabe melhor que ele onde é o rolê.
 * Só cai na geocodificação quando não há escolha, e aí é palpite mesmo,
 * marcado como 'exact' ou 'city' conforme o que resolveu.
 *
 * Best-effort: se o Nominatim falhar, o evento fica sem mapa e nada mais.
 */
async function resolveCoords(
  id: string,
  location: string,
  city: string,
  chosen?: { latitude?: number | null; longitude?: number | null }
) {
  try {
    if (chosen?.latitude != null && chosen?.longitude != null) {
      await eventsRepository.updateCoords(id, {
        latitude: chosen.latitude,
        longitude: chosen.longitude,
        precision: 'pinned',
      });
      return;
    }

    const coords = await geocodingService.geocodeEvent(location, city);
    await eventsRepository.updateCoords(id, coords);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Falha ao definir coordenadas do evento:', err);
  }
}

async function buildResponse(
  rows: EventRow[],
  total: number,
  viewerId: string | undefined,
  center?: { latitude: number; longitude: number }
) {
  let attendingSet = new Set<string>();
  let friendsMap = new Map<string, number>();

  if (viewerId && rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const followingIds = await followsRepository.listFollowingIds(viewerId);

    [attendingSet, friendsMap] = await Promise.all([
      eventsRepository.findAttendingEventIds(ids, viewerId),
      eventsRepository.countFriendsGoing(ids, followingIds),
    ]);
  }

  return {
    events: rows.map((row) => {
      const event = toPublicEvent(
        row,
        viewerId ? attendingSet.has(row.id) : null,
        viewerId ? friendsMap.get(row.id) ?? 0 : null
      );
      // distanceKm só existe quando houve um centro de busca — é o "a 42 km
      // de você" do card, não um campo fixo do evento.
      return center && row.latitude != null && row.longitude != null
        ? {
            ...event,
            distanceKm: Math.round(
              distanceKm(center, { latitude: row.latitude, longitude: row.longitude })
            ),
          }
        : event;
    }),
    total,
  };
}

/**
 * Teto de eventos considerados numa busca por raio.
 *
 * O recorte do círculo e a paginação acontecem em memória (ver distance.ts),
 * então é preciso um limite. 300 cobre com folga o volume atual; quando não
 * cobrir, o caminho é índice geoespacial no banco, não aumentar este número.
 */
const NEARBY_SCAN_LIMIT = 300;

export const eventsService = {
  /** Calendário público: só visibility 'public'. Eventos por link ficam fora. */
  async list(
    filters: {
      city?: string;
      past?: boolean;
      lat?: number;
      lng?: number;
      radiusKm?: number;
    },
    pagination: PaginationParams,
    viewerId?: string
  ) {
    const { lat, lng, radiusKm, ...rest } = filters;

    // Sem centro: listagem normal, paginada pelo banco.
    if (lat === undefined || lng === undefined) {
      const { rows, total } = await eventsRepository.list(
        { ...rest, onlyPublic: true },
        pagination
      );
      return buildResponse(rows, total, viewerId);
    }

    const center = { latitude: lat, longitude: lng };
    const radius = radiusKm ?? 150;

    // A caixa é um quadrado e traz sobra nos cantos; o haversine abaixo
    // recorta o círculo de verdade. Eventos sem coordenada ficam de fora —
    // não há como dizer se estão no raio.
    const { rows } = await eventsRepository.list(
      { ...rest, onlyPublic: true, bbox: boundingBox(center, radius) },
      { page: 1, limit: NEARBY_SCAN_LIMIT, offset: 0 }
    );

    const dentro = rows.filter(
      (row) =>
        row.latitude != null &&
        row.longitude != null &&
        distanceKm(center, { latitude: row.latitude, longitude: row.longitude }) <= radius
    );

    // Pagina em memória: o total precisa ser o do círculo, não o da caixa,
    // senão o app pediria páginas que não existem.
    const pagina = dentro.slice(pagination.offset, pagination.offset + pagination.limit);
    return buildResponse(pagina, dentro.length, viewerId, center);
  },

  async listByOrganizer(username: string, pagination: PaginationParams, viewerId?: string) {
    const profile = await profilesRepository.findByUsername(username);
    if (!profile) {
      throw AppError.notFound('PROFILE_NOT_FOUND', 'Perfil não encontrado');
    }

    // O próprio organizador vê também os eventos por link, que são dele;
    // qualquer outra pessoa vê só os públicos.
    const onlyPublic = viewerId !== profile.id;

    const { rows, total } = await eventsRepository.list(
      { organizerId: profile.id, onlyPublic },
      pagination
    );
    return buildResponse(rows, total, viewerId);
  },

  /**
   * Buscar por id serve tanto pro evento público quanto pro "por link" — ter
   * o id É o convite. Por isso aqui não há filtro de visibilidade.
   */
  async getById(id: string, viewerId?: string) {
    const event = await findEventOrThrow(id);

    if (!viewerId) return toPublicEvent(event, null, null);

    const followingIds = await followsRepository.listFollowingIds(viewerId);
    const [attendingByMe, friendsMap] = await Promise.all([
      eventsRepository.attendanceExists(id, viewerId),
      eventsRepository.countFriendsGoing([id], followingIds),
    ]);

    return toPublicEvent(event, attendingByMe, friendsMap.get(id) ?? 0);
  },

  async create(organizerId: string, input: CreateEventInput) {
    const id = await eventsRepository.create(organizerId, input);

    // Quem cria o evento já está indo — poupa um toque óbvio e deixa a
    // lista de presença nunca zerada. Tem que vir ANTES da leitura, senão
    // a resposta do create sai com attendeesCount 0.
    await eventsRepository.createAttendance(id, organizerId);

    await resolveCoords(id, input.location, input.city, input);

    const event = await findEventOrThrow(id);
    return toPublicEvent(event, true);
  },

  async update(id: string, userId: string, input: UpdateEventInput) {
    const current = await assertOrganizer(id, userId);
    await eventsRepository.update(id, input);

    // Só regeocodifica se o endereço mudou de fato — trocar o horário ou a
    // descrição não deve gastar uma chamada ao Nominatim.
    const location = input.location ?? current.location;
    const city = input.city ?? current.city;
    const coordsChanged = input.latitude !== undefined || input.longitude !== undefined;
    if (coordsChanged || location !== current.location || city !== current.city) {
      await resolveCoords(id, location, city, input);
    }

    const updated = await findEventOrThrow(id);
    const attendingByMe = await eventsRepository.attendanceExists(id, userId);
    return toPublicEvent(updated, attendingByMe);
  },

  async remove(id: string, userId: string) {
    await assertOrganizer(id, userId);
    await eventsRepository.delete(id);
  },

  async uploadPhoto(id: string, userId: string, buffer: Buffer, mimeType: string) {
    await assertOrganizer(id, userId);

    const { publicUrl } = await storageService.uploadImage({
      bucket: STORAGE_BUCKETS.POSTS,
      userId,
      buffer,
      mimeType,
    });

    await eventsRepository.updatePhoto(id, publicUrl);
    const updated = await findEventOrThrow(id);
    const attendingByMe = await eventsRepository.attendanceExists(id, userId);
    return toPublicEvent(updated, attendingByMe);
  },

  // ---------------------------------------------------------------------------
  // Presença
  // ---------------------------------------------------------------------------

  /**
   * Confirmar presença, opcionalmente dizendo qual carro vai levar.
   *
   * O carro é opcional de propósito: muita gente vai de carona, a pé, ou
   * justamente pra fotografar o carro dos outros. Obrigar a escolher
   * transformaria um toque em dois e excluiria quem não tem carro.
   */
  async attend(eventId: string, userId: string, carId?: string | null) {
    await findEventOrThrow(eventId);

    // Só dá pra levar carro que é seu — declarar o carro alheio seria um
    // jeito silencioso de colocá-lo na lista do rolê sem ele saber.
    if (carId) await assertCarOwnership(carId, userId);

    const already = await eventsRepository.attendanceExists(eventId, userId);
    if (already) {
      throw AppError.conflict('ALREADY_ATTENDING', 'Você já confirmou presença neste evento');
    }

    await eventsRepository.createAttendance(eventId, userId, carId);
    const attendeesCount = await eventsRepository.countAttendees(eventId);

    const followerIds = await followsRepository.listFollowerIds(userId);
    await notificationsService.notifyEventAttend(followerIds, userId, eventId);

    return { attendingByMe: true, attendeesCount };
  },

  async unattend(eventId: string, userId: string) {
    await findEventOrThrow(eventId);

    const attending = await eventsRepository.attendanceExists(eventId, userId);
    if (!attending) {
      throw AppError.notFound('ATTENDANCE_NOT_FOUND', 'Você ainda não confirmou presença');
    }

    await eventsRepository.deleteAttendance(eventId, userId);
    const attendeesCount = await eventsRepository.countAttendees(eventId);

    return { attendingByMe: false, attendeesCount };
  },

  /** Trocar (ou tirar) o carro depois de já ter confirmado. */
  async updateAttendanceCar(eventId: string, userId: string, carId: string | null) {
    await findEventOrThrow(eventId);

    const attending = await eventsRepository.attendanceExists(eventId, userId);
    if (!attending) {
      throw AppError.notFound('ATTENDANCE_NOT_FOUND', 'Confirme presença antes de escolher o carro');
    }

    if (carId) await assertCarOwnership(carId, userId);

    await eventsRepository.updateAttendanceCar(eventId, userId, carId);
    return { carId };
  },

  async listAttendees(eventId: string, pagination: PaginationParams) {
    await findEventOrThrow(eventId);
    const { rows, total } = await eventsRepository.listAttendees(eventId, pagination);
    return { attendees: rows.map(toPublicAttendee), total };
  },
};
