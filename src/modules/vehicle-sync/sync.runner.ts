/* eslint-disable no-console */
import { vehicleSyncService } from './vehicle-sync.service';

/**
 * Script standalone, executado via cron/job externo (nunca a partir de uma
 * requisição HTTP do usuário).
 *
 * Uso:
 *   npm run sync:fipe                          -> sincroniza hierarquia (sem preços)
 *   npm run sync:fipe -- --with-prices         -> também busca preço de cada versão
 *   npm run sync:fipe -- --brand-limit=5       -> limita a 5 marcas (útil em dev)
 */
async function main() {
  const args = process.argv.slice(2);
  const fetchPrices = args.includes('--with-prices');
  const brandLimitArg = args.find((arg) => arg.startsWith('--brand-limit='));
  const brandLimit = brandLimitArg ? Number(brandLimitArg.split('=')[1]) : undefined;

  console.log('🔄 Iniciando sincronização FIPE...', { fetchPrices, brandLimit });

  const { logId, counters } = await vehicleSyncService.run({ fetchPrices, brandLimit });

  console.log('✔ Sincronização concluída.', { logId, ...counters });
}

main().catch((err) => {
  console.error('❌ Falha na sincronização FIPE:', err);
  process.exit(1);
});
