import { supabaseAdmin } from '@/config/supabase';

export interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'failed';
  records_processed: number;
  records_created: number;
  records_updated: number;
  error_message: string | null;
}

export interface SyncCounters {
  processed: number;
  created: number;
  updated: number;
}

/**
 * Camada de acesso a dados do sincronizador FIPE. Sempre usa upsert com
 * base no código FIPE para evitar duplicados, e nunca sobrescreve dados
 * de forma destrutiva (apenas insere/atualiza).
 */
export const vehicleSyncRepository = {
  async startLog(): Promise<SyncLog> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_sync_logs')
      .insert({ status: 'running' })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async finishLog(
    logId: string,
    status: 'success' | 'failed',
    counters: SyncCounters,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('vehicle_sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status,
        records_processed: counters.processed,
        records_created: counters.created,
        records_updated: counters.updated,
        error_message: errorMessage ?? null,
      })
      .eq('id', logId);

    if (error) throw error;
  },

  /**
   * Upsert de uma marca. Retorna o id e se o registro foi criado agora
   * (para contabilização nos logs).
   */
  async upsertBrand(name: string, fipeCode: string): Promise<{ id: string; created: boolean }> {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('vehicle_brands')
      .select('id')
      .eq('fipe_code', fipeCode)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('vehicle_brands')
        .update({ name })
        .eq('id', existing.id);

      if (updateError) throw updateError;
      return { id: existing.id, created: false };
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('vehicle_brands')
      .insert({ name, fipe_code: fipeCode })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return { id: created.id, created: true };
  },

  async upsertModel(
    brandId: string,
    name: string,
    fipeCode: string
  ): Promise<{ id: string; created: boolean }> {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('vehicle_models')
      .select('id')
      .eq('brand_id', brandId)
      .eq('fipe_code', fipeCode)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('vehicle_models')
        .update({ name })
        .eq('id', existing.id);

      if (updateError) throw updateError;
      return { id: existing.id, created: false };
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('vehicle_models')
      .insert({ brand_id: brandId, name, fipe_code: fipeCode })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return { id: created.id, created: true };
  },

  async upsertVersion(params: {
    modelId: string;
    name: string;
    year: number;
    fuel: string | null;
    fipeCode: string;
    fipePrice: number | null;
    fipeReferenceMonth: string | null;
  }): Promise<{ id: string; created: boolean }> {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('vehicle_versions')
      .select('id')
      .eq('model_id', params.modelId)
      .eq('fipe_code', params.fipeCode)
      .maybeSingle();

    if (findError) throw findError;

    const payload = {
      name: params.name,
      year: params.year,
      fuel: params.fuel,
      fipe_price: params.fipePrice,
      fipe_reference_month: params.fipeReferenceMonth,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('vehicle_versions')
        .update(payload)
        .eq('id', existing.id);

      if (updateError) throw updateError;
      return { id: existing.id, created: false };
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('vehicle_versions')
      .insert({ model_id: params.modelId, fipe_code: params.fipeCode, ...payload })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return { id: created.id, created: true };
  },
};
