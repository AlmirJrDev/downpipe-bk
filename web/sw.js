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
