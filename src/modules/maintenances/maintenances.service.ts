import { AppError } from '@/shared/utils/AppError';
import { assertCarOwnership } from '@/modules/cars/cars.service';
import { maintenancesRepository, MaintenanceRow } from './maintenances.repository';
import { CreateMaintenanceInput, UpdateMaintenanceInput } from './maintenances.schema';

/** A partir daqui o app pinta o item de "tá na hora". */
const DIAS_DE_AVISO = 15;
const KM_DE_AVISO = 500;

export interface ProximaManutencao {
  /** Data limite (AAAA-MM-DD), quando o item tem intervalo em meses. */
  emData: string | null;
  /** Quilometragem limite, quando o item tem intervalo em km. */
  emKm: number | null;
  /** Negativo quando já passou. Null se o carro não tem quilometragem. */
  faltamKm: number | null;
  faltamDias: number | null;
  vencida: boolean;
  perto: boolean;
  /** Uma linha pronta pra tela e pro push: "faltam 800 km", "venceu há 3 dias". */
  resumo: string | null;
}

function somarMeses(iso: string, meses: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  const dia = data.getUTCDate();
  data.setUTCMonth(data.getUTCMonth() + meses);
  // 31/01 + 1 mês vira 03/03 no JS puro; voltar pro último dia do mês certo é
  // o que qualquer oficina entenderia por "daqui a um mês".
  if (data.getUTCDate() < dia) data.setUTCDate(0);
  return data.toISOString().slice(0, 10);
}

const emDias = (de: Date, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - de.getTime()) / 86_400_000);

/**
 * Quando esta manutenção vence — o coração da feature.
 *
 * Duas contas independentes, e vale a que chegar primeiro: por quilometragem
 * (odômetro da troca + intervalo, comparado com o km atual do carro) e por
 * tempo (data da troca + meses). Item sem nenhum dos dois é só histórico.
 */
export function calcularProxima(
  m: Pick<MaintenanceRow, 'done_at' | 'odometer' | 'interval_km' | 'interval_months'>,
  kmAtual: number | null,
  agora = new Date()
): ProximaManutencao {
  const emKm = m.interval_km != null && m.odometer != null ? m.odometer + m.interval_km : null;
  const emData = m.interval_months != null ? somarMeses(m.done_at, m.interval_months) : null;

  const faltamKm = emKm != null && kmAtual != null ? emKm - kmAtual : null;
  const faltamDias = emData != null ? emDias(agora, emData) : null;

  const vencida = (faltamKm != null && faltamKm <= 0) || (faltamDias != null && faltamDias <= 0);
  const perto =
    !vencida &&
    ((faltamKm != null && faltamKm <= KM_DE_AVISO) ||
      (faltamDias != null && faltamDias <= DIAS_DE_AVISO));

  return { emData, emKm, faltamKm, faltamDias, vencida, perto, resumo: resumir(faltamKm, faltamDias, emData) };
}

function resumir(
  faltamKm: number | null,
  faltamDias: number | null,
  emData: string | null
): string | null {
  // Km ganha da data quando os dois existem: quem anota quilometragem acompanha
  // o carro por ela, e é o número que chega primeiro na prática.
  if (faltamKm != null) {
    if (faltamKm <= 0) return `passou ${Math.abs(faltamKm).toLocaleString('pt-BR')} km do prazo`;
    return `faltam ${faltamKm.toLocaleString('pt-BR')} km`;
  }
  if (faltamDias != null && emData != null) {
    if (faltamDias < 0) return `venceu há ${Math.abs(faltamDias)} dia${Math.abs(faltamDias) === 1 ? '' : 's'}`;
    if (faltamDias === 0) return 'vence hoje';
    if (faltamDias === 1) return 'vence amanhã';
    if (faltamDias <= 45) return `faltam ${faltamDias} dias`;
    const [ano, mes, dia] = emData.split('-');
    return `vence em ${dia}/${mes}/${ano}`;
  }
  return null;
}

function toPublic(row: MaintenanceRow, kmAtual: number | null, agora?: Date) {
  return {
    id: row.id,
    carId: row.car_id,
    kind: row.kind,
    doneAt: row.done_at,
    odometer: row.odometer,
    intervalKm: row.interval_km,
    intervalMonths: row.interval_months,
    cost: row.cost,
    notes: row.notes,
    proxima: calcularProxima(row, kmAtual, agora),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function acharDaPessoa(id: string, userId: string): Promise<MaintenanceRow> {
  const manutencao = await maintenancesRepository.findById(id);
  if (!manutencao) {
    throw AppError.notFound('MAINTENANCE_NOT_FOUND', 'Manutenção não encontrada');
  }
  await assertCarOwnership(manutencao.car_id, userId);
  return manutencao;
}

export const maintenancesService = {
  /**
   * A lista é só do dono: manutenção é diário de bordo, não vitrine. Quem
   * visita a garagem vê as modificações, não a nota do óleo nem o km real.
   */
  async listByCar(carId: string, userId: string) {
    const car = await assertCarOwnership(carId, userId);
    const linhas = await maintenancesRepository.listByCar(carId);
    const agora = new Date();
    return linhas.map((linha) => toPublic(linha, car.mileage ?? null, agora));
  },

  async create(carId: string, userId: string, input: CreateMaintenanceInput) {
    const car = await assertCarOwnership(carId, userId);
    const criada = await maintenancesRepository.create(carId, input);
    return toPublic(criada, car.mileage ?? null);
  },

  async update(id: string, userId: string, input: UpdateMaintenanceInput) {
    const atual = await acharDaPessoa(id, userId);
    const atualizada = await maintenancesRepository.update(atual.id, input);
    const car = await assertCarOwnership(atual.car_id, userId);
    return toPublic(atualizada, car.mileage ?? null);
  },

  async remove(id: string, userId: string) {
    const atual = await acharDaPessoa(id, userId);
    await maintenancesRepository.delete(atual.id);
    return { deleted: true };
  },
};
