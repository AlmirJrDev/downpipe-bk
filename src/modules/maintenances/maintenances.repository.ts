import { supabaseAdmin } from '@/config/supabase';
import { CreateMaintenanceInput, UpdateMaintenanceInput } from './maintenances.schema';

export interface MaintenanceRow {
  id: string;
  car_id: string;
  kind: string;
  done_at: string;
  odometer: number | null;
  interval_km: number | null;
  interval_months: number | null;
  cost: number | null;
  notes: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A manutenção com o carro e o dono junto — o lembrete precisa dos três. */
export interface MaintenanceComCarro extends MaintenanceRow {
  cars: {
    id: string;
    owner_id: string;
    version: string | null;
    mileage: number | null;
  } | null;
}

function toDbPayload(
  input: CreateMaintenanceInput | UpdateMaintenanceInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.kind !== undefined) payload.kind = input.kind;
  if (input.doneAt !== undefined) payload.done_at = input.doneAt;
  if (input.odometer !== undefined) payload.odometer = input.odometer;
  if (input.intervalKm !== undefined) payload.interval_km = input.intervalKm;
  if (input.intervalMonths !== undefined) payload.interval_months = input.intervalMonths;
  if (input.cost !== undefined) payload.cost = input.cost;
  if (input.notes !== undefined) payload.notes = input.notes;

  // Mexeu no prazo, o lembrete volta à fila: trocar o intervalo de 10 mil pra
  // 5 mil km sem isso deixaria o item calado pra sempre.
  if (
    input.doneAt !== undefined ||
    input.odometer !== undefined ||
    input.intervalKm !== undefined ||
    input.intervalMonths !== undefined
  ) {
    payload.notified_at = null;
  }

  return payload;
}

export const maintenancesRepository = {
  async listByCar(carId: string): Promise<MaintenanceRow[]> {
    const { data, error } = await supabaseAdmin
      .from('maintenances')
      .select('*')
      .eq('car_id', carId)
      .order('done_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async findById(id: string): Promise<MaintenanceRow | null> {
    const { data, error } = await supabaseAdmin
      .from('maintenances')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(carId: string, input: CreateMaintenanceInput): Promise<MaintenanceRow> {
    const { data, error } = await supabaseAdmin
      .from('maintenances')
      .insert({ car_id: carId, ...toDbPayload(input) })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateMaintenanceInput): Promise<MaintenanceRow> {
    const { data, error } = await supabaseAdmin
      .from('maintenances')
      .update(toDbPayload(input))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('maintenances').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Candidatas a lembrete: tem prazo definido e ainda não avisaram.
   *
   * Quem decide se venceu é o service — a conta por km depende da
   * quilometragem atual do carro, que muda fora daqui.
   */
  async pendentes(limite = 200): Promise<MaintenanceComCarro[]> {
    const { data, error } = await supabaseAdmin
      .from('maintenances')
      .select('*, cars ( id, owner_id, version, mileage )')
      .is('notified_at', null)
      .or('interval_km.not.is.null,interval_months.not.is.null')
      .order('done_at', { ascending: true })
      .limit(limite);

    if (error) throw error;
    return (data ?? []) as MaintenanceComCarro[];
  },

  async marcarAvisada(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('maintenances')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
