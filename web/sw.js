/**
 * Service worker do Downpipe.
 *
 * Deliberadamente pequeno. Um app de fotos não tem uso offline de verdade:
 * o valor aqui é abrir rápido na segunda visita e poder ser instalado na
 * tela inicial — não funcionar no modo avião.
 *
 * Regra única: cache eterno só para os arquivos do bundle, cujos nomes já
 * carregam o hash do conteúdo (/_expo/static/js/web/entry-<hash>.js). Como o
 * nome muda a cada build, servir do cache nunca entrega versão velha.
 *
 * Todo o resto — HTML, chamadas de API, imagens do Supabase — vai direto na
 * rede. É o que garante que ninguém veja um feed congelado de ontem.
 *
 * Além disso, ao final do arquivo: os dois eventos que sustentam push
 * (receber e reagir ao toque). Um service worker é obrigatório pra
 * notificação push existir no navegador — não tem como fazer isso de
 * dentro da página, porque a página pode nem estar aberta quando a
 * notificação chega.
 */
const CACHE = 'downpipe-estaticos-v1';

self.addEventListener('install', (event) => {
  // Assume o controle sem esperar a aba antiga fechar.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const eEstatico = url.origin === self.location.origin && url.pathname.startsWith('/_expo/static/');
  if (!eEstatico) return; // rede, sem intermediário

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(request);
      if (guardado) return guardado;

      const resposta = await fetch(request);
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    })()
  );
});

/**
 * Push chega aqui mesmo com o app fechado — é o próprio sistema operacional
 * que acorda o service worker. O payload é o JSON que push.service.ts monta
 * no backend: { title, body, url }.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return; // payload que não é o JSON esperado — nada a mostrar.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      // No Android o "badge" é o ícone monocromático da barra de status.
      // Reusar o icon-192 é um resultado razoável sem criar um asset novo
      // só pra isso.
      badge: '/icon-192.png',
      data: { url: payload.url },
    })
  );
});

/**
 * Tocar na notificação. Preferência por focar uma aba do app já aberta e
 * navegar nela, em vez de abrir uma aba nova a cada notificação — depois de
 * um dia de uso isso viraria uma dezena de abas do mesmo PWA.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url;
  if (!url) return;

  const destino = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      const jaAberta = abas.find((c) => c.url === destino);
      if (jaAberta) return jaAberta.focus();

      const doApp = abas.find((c) => c.url.startsWith(self.location.origin));
      if (doApp) {
        await doApp.focus();
        if ('navigate' in doApp) return doApp.navigate(destino);
      }

      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })()
  );
});
