import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { carsRepository } from '@/modules/cars/cars.repository';
import { toPublicCar } from '@/modules/cars/cars.service';
import { vehicleCatalogRepository } from '@/modules/vehicle-catalog/vehicle-catalog.repository';

const RESULTS_PER_CATEGORY = 10;

/**
 * Busca simples (conforme especificação: "não precisa implementar busca
 * extremamente sofisticada"): consulta usuários, carros, marcas e modelos
 * em paralelo e retorna cada categoria já agrupada, com um limite fixo por
 * categoria em vez de uma paginação global unificada.
 */
export const searchService = {
  async search(query: string) {
    const [profiles, cars, catalog] = await Promise.all([
      profilesRepository.search(query, RESULTS_PER_CATEGORY),
      carsRepository.search(query, RESULTS_PER_CATEGORY),
      vehicleCatalogRepository.search(query, {
        page: 1,
        limit: RESULTS_PER_CATEGORY,
        offset: 0,
      }),
    ]);

    return {
      users: profiles.map((p) => ({
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
      })),
      // Carro completo (mesmo formato de GET /cars), com dono e catálogo:
      // assim o app renderiza o resultado com o mesmo card da Explorar, em
      // vez de precisar buscar cada carro de novo pra ter marca e dono.
      cars: cars.map(toPublicCar),
      brands: catalog.brands.map((b) => ({ id: b.id, name: b.name })),
      models: catalog.models.map((m) => ({ id: m.id, name: m.name, brandId: m.brand_id })),
    };
  },
};
