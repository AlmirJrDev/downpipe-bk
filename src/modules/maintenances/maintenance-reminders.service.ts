import { maintenancesRepository } from './maintenances.repository';
import { calcularProxima } from './maintenances.service';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';
import { pushService } from '@/shared/push/push.service';

/**
 * Avisa o dono quando a manutenção vence.
 *
 * Sem isto, o registro seria só um caderninho bonito: ninguém abre o app pra
 * conferir se a correia venceu. O aviso é o que transforma a garagem em algo
 * que serve pra alguma coisa entre um rolê e outro.
 *
 * Um aviso por item (`notified_at`). Mexer no prazo devolve o item pra fila —
 * quem registra a troca nova cria outro item, e o antigo vira histórico.
 */
async function avisar(
  carId: string,
  ownerId: string,
  carro: string,
  kind: string,
  resumo: string | null
) {
  const badge = await notificationsRepository.countUnread(ownerId);
  await pushService.sendToUser(ownerId, {
    title: `${carro}: ${kind}`,
    body: resumo ? `Manutenção ${resumo}.` : 'Manutenção vencida.',
    url: `/app/car/${carId}`,
    badge,
  });
}

export const maintenanceRemindersService = {
  async enviarPendentes(agora = new Date()) {
    const candidatas = await maintenancesRepository.pendentes();

    let avisos = 0;
    for (const m of candidatas) {
      const carro = m.cars;
      // Carro apagado no meio do caminho: o cascade tira a manutenção junto,
      // mas a leitura pode ter pego o estado anterior.
      if (!carro) continue;

      const proxima = calcularProxima(m, carro.mileage ?? null, agora);
      if (!proxima.vencida) continue;

      try {
        await avisar(carro.id, carro.owner_id, carro.version ?? 'Seu carro', m.kind, proxima.resumo);
        await maintenancesRepository.marcarAvisada(m.id);
        avisos += 1;
      } catch (err) {
        // Um item com problema não pode calar os outros; sem a marca, ele
        // volta na próxima rodada.
        // eslint-disable-next-line no-console
        console.warn('Falha no lembrete de manutenção', m.id, err instanceof Error ? err.message : err);
      }
    }

    return { candidatas: candidatas.length, avisos };
  },
};
