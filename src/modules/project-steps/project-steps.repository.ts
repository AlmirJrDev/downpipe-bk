import { supabaseAdmin } from '@/config/supabase';
import { CreateStepInput, UpdateStepInput } from './project-steps.schema';

export interface ProjectStepRow {
  id: string;
  project_id: string;
  car_id: string;
  name: string;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  date: string | null;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function toDbPayload(input: CreateStepInput | UpdateStepInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.status !== undefined) payload.status = input.status;
  if (input.estimatedCost !== undefined) payload.estimated_cost = input.estimatedCost;
  if (input.actualCost !== undefined) payload.actual_cost = input.actualCost;
  if (input.date !== undefined) payload.date = input.date;
  if (input.description !== undefined) payload.description = input.description;
  if (input.position !== undefined) payload.position = input.position;

  return payload;
}

export const projectStepsRepository = {
  async listByProject(projectId: string): Promise<ProjectStepRow[]> {
    const { data, error } = await supabaseAdmin
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async findById(stepId: string): Promise<ProjectStepRow | null> {
    const { data, error } = await supabaseAdmin
      .from('project_steps')
      .select('*')
      .eq('id', stepId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getNextPosition(projectId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('project_steps')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? data.position + 1 : 0;
  },

  async create(projectId: string, carId: string, input: CreateStepInput, position: number): Promise<ProjectStepRow> {
    const { data, error } = await supabaseAdmin
      .from('project_steps')
      .insert({
        project_id: projectId,
        car_id: carId,
        position,
        ...toDbPayload(input),
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async update(stepId: string, input: UpdateStepInput): Promise<ProjectStepRow> {
    const { data, error } = await supabaseAdmin
      .from('project_steps')
      .update(toDbPayload(input))
      .eq('id', stepId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async delete(stepId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('project_steps').delete().eq('id', stepId);
    if (error) throw error;
  },
};
