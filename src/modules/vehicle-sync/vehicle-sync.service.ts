import { fipeClient, parseFipePrice } from './fipe.client';
import { vehicleSyncRepository, SyncCounters } from './vehicle-sync.repository';

interface SyncOptions {
  /** Limita a quantidade de marcas processadas (útil para testes locais). */
  brandLimit?: number;
  /** Se true, busca também o preço/detalhe de cada ano (custa 1 request por versão). */
  fetchPrices?: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Orquestra a sincronização completa: marcas -> modelos -> anos -> (opcional) detalhes.
 *
 * IMPORTANTE sobre limites da API pública da FIPE (parallelum): o plano
 * gratuito permite ~500 requisições/dia sem token (1000 com token). Uma
 * sincronização completa com fetchPrices=true pode facilmente ultrapassar
 * esse limite, pois cada versão de cada modelo de cada marca custa uma
 * requisição adicional. Recomendações:
 *   - Rodar com fetchPrices=false na maior parte das execuções (sincroniza
 *     apenas a hierarquia marca/modelo/ano, sem preço).
 *   - Rodar com fetchPrices=true apenas periodicamente (ex.: 1x por semana)
 *     e, se necessário, usar brandLimit para sincronizar em lotes.
 *   - Considerar obter um token gratuito da FIPE para o limite de 1000/dia.
 */
export const vehicleSyncService = {
  async run(options: SyncOptions = {}): Promise<{ logId: string; counters: SyncCounters }> {
    const log = await vehicleSyncRepository.startLog();
    const counters: SyncCounters = { processed: 0, created: 0, updated: 0 };

    try {
      const brands = await fipeClient.getBrands();
      const brandsToProcess = options.brandLimit ? brands.slice(0, options.brandLimit) : brands;

      for (const brand of brandsToProcess) {
        const brandResult = await vehicleSyncRepository.upsertBrand(brand.nome, brand.codigo);
        counters.processed += 1;
        brandResult.created ? (counters.created += 1) : (counters.updated += 1);

        const { modelos } = await fipeClient.getModels(brand.codigo);

        for (const model of modelos) {
          const modelResult = await vehicleSyncRepository.upsertModel(
            brandResult.id,
            model.nome,
            String(model.codigo)
          );
          counters.processed += 1;
          modelResult.created ? (counters.created += 1) : (counters.updated += 1);

          const years = await fipeClient.getYears(brand.codigo, model.codigo);

          for (const year of years) {
            const yearNumber = Number.parseInt(year.codigo.split('-')[0], 10);
            // A FIPE às vezes devolve um pseudo-ano "32000" (placeholder de
            // "zero km"/ano corrente) que viola o check constraint do banco
            // (year between 1900 and 2100). Sem esse guard, o insert falha
            // e derruba o loop inteiro (e a marca inteira) antes de gravar
            // os anos válidos seguintes.
            if (yearNumber < 1900 || yearNumber > 2100) continue;

            let fipePrice: number | null = null;
            let referenceMonth: string | null = null;
            let fuel: string | null = null;

            if (options.fetchPrices) {
              const details = await fipeClient.getDetails(brand.codigo, model.codigo, year.codigo);
              fipePrice = parseFipePrice(details.Valor);
              referenceMonth = details.MesReferencia;
              fuel = details.Combustivel;
              // Pequeno atraso para não sobrecarregar/estourar rate limit da FIPE.
              await sleep(50);
            }

            const versionResult = await vehicleSyncRepository.upsertVersion({
              modelId: modelResult.id,
              name: year.nome,
              year: yearNumber,
              fuel,
              fipeCode: year.codigo,
              fipePrice,
              fipeReferenceMonth: referenceMonth,
            });

            counters.processed += 1;
            versionResult.created ? (counters.created += 1) : (counters.updated += 1);
          }
        }
      }

      await vehicleSyncRepository.finishLog(log.id, 'success', counters);
      return { logId: log.id, counters };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido na sincronização';
      await vehicleSyncRepository.finishLog(log.id, 'failed', counters, message);
      throw err;
    }
  },
};
