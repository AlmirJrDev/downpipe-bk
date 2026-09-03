import webpush from 'web-push';
import { env } from '@/config/env';
import { pushSubscriptionsRepository } from '@/modules/push-subscriptions/push-subscriptions.repository';

const configurado = !!env.WEB_PUSH_VAPID_PUBLIC_KEY && !!env.WEB_PUSH_VAPID_PRIVATE_KEY;

if (configurado) {
  webpush.setVapidDetails(
    env.WEB_PUSH_SUBJECT,
    env.WEB_PUSH_VAPID_PUBLIC_KEY!,
    env.WEB_PUSH_VAPID_PRIVATE_KEY!
  );
} else {
  // Aviso uma vez, na subida — não a cada notificação que deixa de sair.
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY não configuradas: push desligado, o resto do app segue normal.'
  );
}

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho relativo (ex: "/app/event/uuid") pro clique abrir a tela certa. */
  url: string;
}

export const pushService = {
  /**
   * Manda a mesma notificação pra todos os aparelhos inscritos do usuário
   * (pode ter mais de um — celular e computador, por exemplo).
   *
   * Nunca lança: é chamado de dentro do fluxo de curtir/comentar/seguir, e
   * uma falha de push não pode derrubar a ação que gerou a notificação —
   * mesma regra que notificationsService já segue pro registro interno.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!configurado) return;

    try {
      const subscriptions = await pushSubscriptionsRepository.listByUserId(userId);
      if (subscriptions.length === 0) return;

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify(payload)
            );
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            // 404/410 = o navegador cancelou essa inscrição (desinstalou o
            // app, limpou os dados) e o serviço de push está avisando que
            // ela não existe mais. Continuar tentando nela pra sempre só
            // acumularia erro morto — apaga.
            if (status === 404 || status === 410) {
              await pushSubscriptionsRepository.deleteByEndpoint(sub.endpoint).catch(() => {});
            } else {
              // eslint-disable-next-line no-console
              console.warn('Falha ao enviar push:', status ?? err);
            }
          }
        })
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Falha ao buscar inscrições de push:', err);
    }
  },
};
