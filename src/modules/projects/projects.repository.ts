import { supabaseAdmin } from '@/config/supabase';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema';

export interface ProjectRow {
  id: string;
  car_id: string;
  title: string;
  power_goal_from: number | null;
  power_goal_to: number | null;
  budget_total: number | null;
  budget_spent: number;
  modifications_total: number;
  modifications_done: number;
  created_at: string;
  updated_at: string;
}

function toDbPayload(input: CreateProjectInput | UpdateProjectInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.powerGoalFrom !== undefined) payload.power_goal_from = input.powerGoalFrom;
  if (input.powerGoalTo !== undefined) payload.power_goal_to = input.powerGoalTo;
  if (input.budgetTotal !== undefined) payload.budget_total = input.budgetTotal;

  return payload;
}

export const projectsRepository = {
  async findByCarId(carId: string): Promise<ProjectRow | null> {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('car_id', carId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<ProjectRow | null> {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(carId: string, input: CreateProjectInput): Promise<ProjectRow> {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({ car_id: carId, ...toDbPayload(input) })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRow> {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(toDbPayload(input))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
