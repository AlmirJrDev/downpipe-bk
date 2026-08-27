import { supabaseAdmin } from '@/config/supabase';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';

export interface VehicleBrandRow {
  id: string;
  name: string;
  fipe_code: string;
}

export interface VehicleModelRow {
  id: string;
  brand_id: string;
  name: string;
  fipe_code: string;
}

export interface VehicleVersionRow {
  id: string;
  model_id: string;
  name: string;
  year: number;
  fuel: string | null;
  fipe_code: string;
  fipe_price: number | null;
  fipe_reference_month: string | null;
}

export interface VehicleVersionWithLineage extends VehicleVersionRow {
  vehicle_models: {
    id: string;
    name: string;
    vehicle_brands: { id: string; name: string };
  };
}

/**
 * Leitura pública do catálogo próprio de veículos. Nunca chama a API da
 * FIPE diretamente — os dados aqui são alimentados pelo módulo vehicle-sync.
 */
export const vehicleCatalogRepository = {
  async listBrands(): Promise<VehicleBrandRow[]> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_brands')
      .select('id, name, fipe_code')
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async listModelsByBrand(brandId: string): Promise<VehicleModelRow[]> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_models')
      .select('id, brand_id, name, fipe_code')
      .eq('brand_id', brandId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async findBrandById(brandId: string): Promise<VehicleBrandRow | null> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_brands')
      .select('id, name, fipe_code')
      .eq('id', brandId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listYearsByModel(modelId: string): Promise<VehicleVersionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_versions')
      .select('id, model_id, name, year, fuel, fipe_code, fipe_price, fipe_reference_month')
      .eq('model_id', modelId)
      .order('year', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Modelo + código FIPE da marca-mãe, num só round-trip — é o que o
   * fallback de "lazy populate" do service precisa pra chamar
   * fipeClient.getYears(brandFipeCode, modelFipeCode).
   */
  async findModelWithBrandCode(
    modelId: string
  ): Promise<(VehicleModelRow & { vehicle_brands: { fipe_code: string } }) | null> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_models')
      .select('id, brand_id, name, fipe_code, vehicle_brands!inner ( fipe_code )')
      .eq('id', modelId)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as (VehicleModelRow & { vehicle_brands: { fipe_code: string } }) | null;
  },

  async findVersionById(id: string): Promise<VehicleVersionWithLineage | null> {
    const { data, error } = await supabaseAdmin
      .from('vehicle_versions')
      .select(
        `id, model_id, name, year, fuel, fipe_code, fipe_price, fipe_reference_month,
         vehicle_models!inner ( id, name, vehicle_brands!inner ( id, name ) )`
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as VehicleVersionWithLineage | null;
  },

  async search(
    query: string,
    { limit, offset }: PaginationParams
  ): Promise<{ brands: VehicleBrandRow[]; models: VehicleModelRow[]; total: number }> {
    const likeQuery = `%${query}%`;

    const [brandsResult, modelsResult] = await Promise.all([
      supabaseAdmin
        .from('vehicle_brands')
        .select('id, name, fipe_code', { count: 'exact' })
        .ilike('name', likeQuery)
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from('vehicle_models')
        .select('id, brand_id, name, fipe_code', { count: 'exact' })
        .ilike('name', likeQuery)
        .range(offset, offset + limit - 1),
    ]);

    if (brandsResult.error) throw brandsResult.error;
    if (modelsResult.error) throw modelsResult.error;

    return {
      brands: brandsResult.data ?? [],
      models: modelsResult.data ?? [],
      total: (brandsResult.count ?? 0) + (modelsResult.count ?? 0),
    };
  },
};
