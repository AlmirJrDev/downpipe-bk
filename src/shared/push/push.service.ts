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
          // Qual serviço de push é este: fcm.googleapis.com (Chrome/Android),
          // web.push.apple.com (Safari/iOS) ou updates.push.services.mozilla.com
          // (Firefox). Diferenciar isso no log é o que separa "o Google recusou
          // meu envio" de "a Apple recusou o dela" quando os dois aparelhos
          // testam junto e só um recebe.
          const servico = new URL(sub.endpoint).hostname;
          try {
            const resposta = await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify(payload),
              {
                // Pede prioridade alta ao serviço de push (vira prioridade
                // alta de verdade no FCM do Android) — é o que dá à
                // notificação uma chance de furar a economia de bateria do
                // aparelho e acordar o navegador mesmo com o app fechado.
                // Sem isso, um Android sob restrição de bateria pode
                // segurar a entrega até a próxima vez que o app abrir —
                // exatamente o sintoma visto no teste real: o Google aceita
                // (201) e o aparelho nunca mostra.
                //
                // Não resolve tudo sozinho: se o fabricante do aparelho
                // bloqueia a notificação manualmente (a pessoa precisa
                // liberar "sem restrição de bateria" pro app/site), nenhuma
                // prioridade de envio contorna isso — é ajuste que só quem
                // usa o aparelho pode fazer.
                urgency: 'high',
              }
            );
            // Sucesso aqui só prova que o SERVIÇO DE PUSH aceitou a entrega
            // (200/201) — não que o aparelho já mostrou a notificação. O que
            // acontece depois desse ponto (acordar o navegador, entregar ao
            // service worker) é responsabilidade da Apple/Google, fora do
            // alcance do backend.
            // eslint-disable-next-line no-console
            console.log(`Push aceito por ${servico}: status ${resposta.statusCode}`);
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
              console.warn(`Falha ao enviar push por ${servico}:`, status ?? err);
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
