import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { CreateCarInput, UpdateCarInput, ListCarsQuery } from './cars.schema';

export interface CarRow {
  id: string;
  owner_id: string;
  vehicle_version_id: string | null;
  version: string | null;
  engine: string | null;
  power: number | null;
  torque: number | null;
  transmission: string | null;
  drivetrain: string | null;
  mileage: number | null;
  description: string | null;
  photo_url: string | null;
  status: string;
  project_progress: number;
  amount_invested: number;
  category: string | null;
  created_at: string;
  updated_at: string;
  profiles: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  // vehicle_version_id é opcional, então esse join vem null quando o carro
  // não está linkado ao catálogo — nunca "!inner" aqui de propósito.
  vehicle_versions: {
    id: string;
    name: string;
    year: number;
    vehicle_models: {
      id: string;
      name: string;
      vehicle_brands: { id: string; name: string };
    };
  } | null;
}

// Mesmo padrão de select-com-lineage que vehicle-catalog.repository já usa
// em findVersionById — aqui aplicado a todo select de carro, pra CarCard/
// car detail terem marca/modelo/ano sem precisar de uma requisição extra
// por carro.
const CAR_SELECT = `
  *,
  profiles ( id, username, display_name, avatar_url ),
  vehicle_versions (
    id, name, year,
    vehicle_models ( id, name, vehicle_brands ( id, name ) )
  )
`;

/**
 * Em quantos rolês o carro já apareceu.
 *
 * Não existe vínculo direto entre carro e evento — o que existe é a
 * publicação, que carrega os dois. Então "esse carro esteve nesse rolê"
 * significa: há foto dele marcada com aquele encontro. É um sinal honesto e
 * de graça; um vínculo explícito exigiria perguntar "vai com qual carro?" na
 * hora de confirmar presença, o que encheria de atrito um toque que hoje é
 * único.
 *
 * Conta eventos DISTINTOS: cinco fotos do mesmo rolê continuam sendo um rolê.
 */
export async function countEventsForCar(carId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('event_id')
    .eq('car_id', carId)
    .not('event_id', 'is', null);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.event_id)).size;
}

function toDbPayload(input: CreateCarInput | UpdateCarInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.vehicleVersionId !== undefined) payload.vehicle_version_id = input.vehicleVersionId;
  if (input.version !== undefined) payload.version = input.version;
  if (input.engine !== undefined) payload.engine = input.engine;
  if (input.power !== undefined) payload.power = input.power;
  if (input.torque !== undefined) payload.torque = input.torque;
  if (input.transmission !== undefined) payload.transmission = input.transmission;
  if (input.drivetrain !== undefined) payload.drivetrain = input.drivetrain;
  if (input.mileage !== undefined) payload.mileage = input.mileage;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.category !== undefined) payload.category = input.category;

  return payload;
}

export const carsRepository = {
  async list(
    filters: ListCarsQuery & { ownerId?: string },
    { limit, offset }: PaginationParams
  ): Promise<{ rows: CarRow[]; total: number }> {
    let query = supabaseAdmin.from('cars').select(CAR_SELECT, { count: 'exact' });

    if (filters.ownerId) query = query.eq('owner_id', filters.ownerId);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { rows: data ?? [], total: count ?? 0 };
  },

  async findById(id: string): Promise<CarRow | null> {
    const { data, error } = await supabaseAdmin.from('cars').select(CAR_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(ownerId: string, input: CreateCarInput): Promise<CarRow> {
    const { data, error } = await supabaseAdmin
      .from('cars')
      .insert({ owner_id: ownerId, ...toDbPayload(input) })
      .select(CAR_SELECT)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateCarInput): Promise<CarRow> {
    const { data, error } = await supabaseAdmin
      .from('cars')
      .update(toDbPayload(input))
      .eq('id', id)
      .select(CAR_SELECT)
      .single();

    if (error) throw error;
    return data;
  },

  async updatePhoto(id: string, photoUrl: string): Promise<CarRow> {
    const { data, error } = await supabaseAdmin
      .from('cars')
      .update({ photo_url: photoUrl })
      .eq('id', id)
      .select(CAR_SELECT)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('cars').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Busca de carros por texto, em três frentes: campos do próprio carro
   * (nome dado pelo dono, descrição, motor), nome do modelo e nome da marca
   * no catálogo. São consultas separadas porque marca e modelo ficam em
   * níveis diferentes do join — o PostgREST não aceita um OR único cobrindo
   * os dois. Sem as duas últimas, procurar "Honda" não achava nenhum carro
   * Honda: só funcionava se o dono tivesse digitado "Honda" no nome dele.
   */
  async search(query: string, limit = 10): Promise<CarRow[]> {
    const like = `%${query}%`;

    // O join !inner é o que permite filtrar o carro por coluna do catálogo;
    // por isso carro sem catálogo aparece só na primeira consulta.
    const CATALOG_SELECT = `*,
      profiles ( id, username, display_name, avatar_url ),
      vehicle_versions!inner (
        id, name, year,
        vehicle_models!inner ( id, name, vehicle_brands!inner ( id, name ) )
      )`;

    const [ownFields, byModel, byBrand] = await Promise.all([
      supabaseAdmin
        .from('cars')
        .select(CAR_SELECT)
        .or(`version.ilike.${like},description.ilike.${like},engine.ilike.${like}`)
        .limit(limit),
      supabaseAdmin
        .from('cars')
        .select(CATALOG_SELECT)
        .ilike('vehicle_versions.vehicle_models.name', like)
        .limit(limit),
      supabaseAdmin
        .from('cars')
        .select(CATALOG_SELECT)
        .ilike('vehicle_versions.vehicle_models.vehicle_brands.name', like)
        .limit(limit),
    ]);

    if (ownFields.error) throw ownFields.error;
    if (byModel.error) throw byModel.error;
    if (byBrand.error) throw byBrand.error;

    // O mesmo carro pode casar em mais de uma frente (ex.: nome dado pelo
    // dono contém a marca) — dedup por id, preservando a ordem.
    const byId = new Map<string, CarRow>();
    for (const row of [...(ownFields.data ?? []), ...(byModel.data ?? []), ...(byBrand.data ?? [])]) {
      const car = row as unknown as CarRow;
      if (!byId.has(car.id)) byId.set(car.id, car);
    }

    return [...byId.values()].slice(0, limit);
  },
};
