import { AppError } from '@/shared/utils/AppError';
import { PaginationParams } from '@/shared/middleware/pagination.middleware';
import { fipeClient } from '@/modules/vehicle-sync/fipe.client';
import { vehicleSyncRepository } from '@/modules/vehicle-sync/vehicle-sync.repository';
import { vehicleCatalogRepository } from './vehicle-catalog.repository';

/**
 * "Populate sob demanda": se a base própria não tem nada pra essa marca/
 * modelo ainda, busca só esse pedaço na FIPE (nunca o catálogo inteiro) e
 * grava via os mesmos upserts que o job batch (vehicle-sync) usa, deduplicando
 * por fipe_code. Nunca deixa a FIPE fora do ar derrubar a leitura: se a
 * chamada falhar, loga e segue com o que já estava na base local.
 */
async function populateBrandsFromFipe(): Promise<void> {
  try {
    const brands = await fipeClient.getBrands();
    for (const brand of brands) {
      await vehicleSyncRepository.upsertBrand(brand.nome, brand.codigo);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Falha ao popular marcas via FIPE (fallback sob demanda):', err);
  }
}

async function populateModelsFromFipe(brandFipeCode: string, brandId: string): Promise<void> {
  try {
    const { modelos } = await fipeClient.getModels(brandFipeCode);
    for (const model of modelos) {
      await vehicleSyncRepository.upsertModel(brandId, model.nome, String(model.codigo));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Falha ao popular modelos via FIPE (fallback sob demanda):', err);
  }
}

async function populateYearsFromFipe(
  brandFipeCode: string,
  modelFipeCode: string,
  modelId: string
): Promise<void> {
  try {
    const years = await fipeClient.getYears(brandFipeCode, Number(modelFipeCode));
    for (const year of years) {
      const yearNumber = Number.parseInt(year.codigo.split('-')[0], 10);
      // A FIPE às vezes devolve um pseudo-ano "32000" (placeholder de
      // "zero km"/ano corrente) que viola o check constraint do banco
      // (year between 1900 and 2100). Sem esse guard, o insert falha e
      // derruba o loop inteiro antes de gravar os anos válidos seguintes.
      if (yearNumber < 1900 || yearNumber > 2100) continue;
      // Sem preço aqui de propósito (custaria 1 request extra por versão) —
      // preço continua responsabilidade só do job cron com --with-prices.
      await vehicleSyncRepository.upsertVersion({
        modelId,
        name: year.nome,
        year: yearNumber,
        fuel: null,
        fipeCode: year.codigo,
        fipePrice: null,
        fipeReferenceMonth: null,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Falha ao popular anos/versões via FIPE (fallback sob demanda):', err);
  }
}

export const vehicleCatalogService = {
  async listBrands() {
    let brands = await vehicleCatalogRepository.listBrands();

    if (brands.length === 0) {
      await populateBrandsFromFipe();
      brands = await vehicleCatalogRepository.listBrands();
    }

    return brands.map((b) => ({ id: b.id, name: b.name, fipeCode: b.fipe_code }));
  },

  async listModelsByBrand(brandId: string) {
    const brand = await vehicleCatalogRepository.findBrandById(brandId);
    if (!brand) {
      throw AppError.notFound('BRAND_NOT_FOUND', 'Marca não encontrada');
    }

    let models = await vehicleCatalogRepository.listModelsByBrand(brandId);

    if (models.length === 0) {
      await populateModelsFromFipe(brand.fipe_code, brand.id);
      models = await vehicleCatalogRepository.listModelsByBrand(brandId);
    }

    return models.map((m) => ({
      id: m.id,
      brandId: m.brand_id,
      name: m.name,
      fipeCode: m.fipe_code,
    }));
  },

  async listYearsByModel(modelId: string) {
    const model = await vehicleCatalogRepository.findModelWithBrandCode(modelId);
    if (!model) {
      throw AppError.notFound('MODEL_NOT_FOUND', 'Modelo não encontrado');
    }

    let versions = await vehicleCatalogRepository.listYearsByModel(modelId);

    if (versions.length === 0) {
      await populateYearsFromFipe(model.vehicle_brands.fipe_code, model.fipe_code, model.id);
      versions = await vehicleCatalogRepository.listYearsByModel(modelId);
    }

    return versions.map((v) => ({
      id: v.id,
      modelId: v.model_id,
      name: v.name,
      year: v.year,
      fuel: v.fuel,
      fipeCode: v.fipe_code,
      fipePrice: v.fipe_price,
      fipeReferenceMonth: v.fipe_reference_month,
    }));
  },

  async getById(id: string) {
    const version = await vehicleCatalogRepository.findVersionById(id);

    if (!version) {
      throw AppError.notFound('VEHICLE_NOT_FOUND', 'Veículo não encontrado');
    }

    return {
      id: version.id,
      name: version.name,
      year: version.year,
      fuel: version.fuel,
      fipeCode: version.fipe_code,
      fipePrice: version.fipe_price,
      fipeReferenceMonth: version.fipe_reference_month,
      model: {
        id: version.vehicle_models.id,
        name: version.vehicle_models.name,
      },
      brand: {
        id: version.vehicle_models.vehicle_brands.id,
        name: version.vehicle_models.vehicle_brands.name,
      },
    };
  },

  async search(query: string, pagination: PaginationParams) {
    const { brands, models, total } = await vehicleCatalogRepository.search(query, pagination);

    return {
      results: [
        ...brands.map((b) => ({ type: 'brand' as const, id: b.id, name: b.name })),
        ...models.map((m) => ({
          type: 'model' as const,
          id: m.id,
          name: m.name,
          brandId: m.brand_id,
        })),
      ],
      total,
    };
  },
};
