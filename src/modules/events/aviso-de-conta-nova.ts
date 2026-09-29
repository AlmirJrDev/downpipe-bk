import { profilesRepository } from '@/modules/profiles/profiles.repository';
import { moderationRepository } from '@/modules/moderation/moderation.repository';
import { notificationsRepository } from '@/modules/notifications/notifications.repository';
import { pushService } from '@/shared/push/push.service';

/**
 * Avisa quem modera quando um rolê é publicado por conta recém-criada.
 *
 * Com o cadastro pedido só na hora de publicar, criar uma conta pra jogar
 * um rolê no calendário ficou a um passo — é o caminho mais curto pra spam
 * e pra rolê falso. O rolê continua indo pro ar na hora (é isso que faz o
 * organizador de verdade voltar); o que muda é que alguém fica sabendo e
 * pode olhar em minutos, em vez de só quando chegar uma denúncia.
 *
 * Conta com mais de um dia já não avisa: aí quem publica é gente que usa o
 * app, e avisar a cada rolê viraria ruído que ninguém lê.
 *
 * Nunca lança. Um aviso que falha não pode fazer a publicação parecer que
 * falhou.
 */

export const JANELA_DE_CONTA_NOVA_MS = 24 * 60 * 60 * 1000;

export async function avisarSeContaNova(
  organizadorId: string,
  role: { id: string; nome: string; cidade: string },
  agora: number = Date.now()
): Promise<void> {
  try {
    const perfil = await profilesRepository.findById(organizadorId);
    if (!perfil) return;
    if (agora - Date.parse(perfil.created_at) > JANELA_DE_CONTA_NOVA_MS) return;

    const admins = await moderationRepository.listAdminIds();
    for (const adminId of admins) {
      // Quem modera e publicou o próprio rolê não precisa do próprio aviso.
      if (adminId === organizadorId) continue;
      const badge = await notificationsRepository.countUnread(adminId);
      await pushService.sendToUser(adminId, {
        title: 'Rolê novo de conta nova',
        body: `${role.nome} · ${role.cidade}`,
        url: `/app/event/${role.id}`,
        badge,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Falha ao avisar rolê de conta nova:', err instanceof Error ? err.message : err);
  }
}
