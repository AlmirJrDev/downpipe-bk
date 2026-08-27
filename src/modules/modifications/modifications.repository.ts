import { supabaseAdmin } from '@/config/supabase';
import { CreateModificationInput, UpdateModificationInput } from './modifications.schema';

export interface ModificationRow {
  id: string;
  car_id: string;
  name: string;
  category: string | null;
  cost: number | null;
  date: string | null;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function toDbPayload(
  input: CreateModificationInput | UpdateModificationInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.category !== undefined) payload.category = input.category;
  if (input.cost !== undefined) payload.cost = input.cost;
  if (input.date !== undefined) payload.date = input.date;
  if (input.icon !== undefined) payload.icon = input.icon;
  if (input.description !== undefined) payload.description = input.description;

  return payload;
}

export const modificationsRepository = {
  async listByCar(carId: string): Promise<ModificationRow[]> {
    const { data, error } = await supabaseAdmin
      .from('modifications')
      .select('*')
      .eq('car_id', carId)
      .order('date', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data ?? [];
  },

  async findById(id: string): Promise<ModificationRow | null> {
    const { data, error } = await supabaseAdmin
      .from('modifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(carId: string, input: CreateModificationInput): Promise<ModificationRow> {
    const { data, error } = await supabaseAdmin
      .from('modifications')
      .insert({ car_id: carId, ...toDbPayload(input) })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateModificationInput): Promise<ModificationRow> {
    const { data, error } = await supabaseAdmin
      .from('modifications')
      .update(toDbPayload(input))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('modifications').delete().eq('id', id);
    if (error) throw error;
  },
};
