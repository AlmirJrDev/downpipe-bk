import express, { Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { notFoundHandler, errorHandler } from '@/shared/middleware/error.middleware';
import authRoutes from '@/modules/auth/auth.routes';
import { meRouter, publicProfilesRouter } from '@/modules/profiles/profiles.routes';
import vehicleCatalogRoutes from '@/modules/vehicle-catalog/vehicle-catalog.routes';
import { carsRouter, profileCarsRouter } from '@/modules/cars/cars.routes';
import { carProjectRouter, projectsRouter } from '@/modules/projects/projects.routes';
import projectStepsRoutes from '@/modules/project-steps/project-steps.routes';
import { carModificationsRouter, modificationsRouter } from '@/modules/modifications/modifications.routes';
import { feedRouter, postsRouter, profilePostsRouter, carPostsRouter } from '@/modules/posts/posts.routes';
import likesRoutes from '@/modules/likes/likes.routes';
import { postSaveRouter, savedPostsRouter } from '@/modules/saved-posts/saved-posts.routes';
import { postCommentsRouter, commentsRouter } from '@/modules/comments/comments.routes';
import followsRoutes from '@/modules/follows/follows.routes';
import notificationsRoutes from '@/modules/notifications/notifications.routes';
import { pushSubscriptionsRouter } from '@/modules/push-subscriptions/push-subscriptions.routes';
import searchRoutes from '@/modules/search/search.routes';
import advertisementsRoutes from '@/modules/advertisements/advertisements.routes';
import statusRoutes from '@/modules/status/status.routes';
import { reportsRouter, blocksRouter, myBlocksRouter } from '@/modules/moderation/moderation.routes';
import { eventsRouter, profileEventsRouter } from '@/modules/events/events.routes';
import { eventPostsRouter } from '@/modules/posts/posts.routes';
import geocodingRoutes from '@/modules/geocoding/geocoding.routes';

export function createApp() {
  const app = express();

  /**
   * Com o PWA servido daqui, a CSP do helmet passa a valer para a página do
   * app — e a padrão ('self' e mais nada) bloqueia silenciosamente toda foto
   * do Supabase e o MapLibre dos mapas. Então ela é declarada explicitamente,
   * liberando só as origens que o app realmente usa.
   *
   * Sem o PWA (só a API), fica a padrão do helmet: não há página para
   * proteger, e afrouxar sem motivo seria pior.
   *
   * 'unsafe-inline' em script-src é a única concessão real: o HTML dos mapas
   * roda em <script> inline dentro do iframe, que herda a CSP desta página.
   * Serve o mapa por uma rota própria (com CSP própria) quando quiser tirar.
   */
  if (env.WEB_DIST_PATH) {
    const supabase = new URL(env.SUPABASE_URL).origin;
    const carto = 'https://*.basemaps.cartocdn.com';

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
            imgSrc: ["'self'", 'data:', 'blob:', supabase, carto, 'https://basemaps.cartocdn.com'],
            // blob: e data: aqui não é redundância com o imgSrc acima. Uma
            // foto escolhida no navegador chega como blob:/data:, e pra
            // virar arquivo de upload ela é lida com fetch — que responde a
            // connect-src, não a img-src. Sem isto a prévia aparecia (img-src
            // permite) mas o envio falhava, o que fazia parecer problema do
            // servidor quando o pedido nem chegava a sair.
            connectSrc: [
              "'self'",
              'blob:',
              'data:',
              supabase,
              'https://unpkg.com',
              carto,
              'https://basemaps.cartocdn.com',
            ],
            // O MapLibre cria seus workers a partir de blob:.
            workerSrc: ["'self'", 'blob:'],
            childSrc: ["'self'", 'blob:'],
            fontSrc: ["'self'", 'data:', 'https://unpkg.com'],
            objectSrc: ["'none'"],
          },
        },
        // A página embute imagem do Supabase; same-origin aqui as barraria.
        crossOriginEmbedderPolicy: false,
      })
    );
  } else {
    app.use(helmet());
  }
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' }, error: null });
  });

  // Fase 1
  app.use('/auth', authRoutes);
  app.use('/profile', meRouter);
  app.use('/profiles', publicProfilesRouter);

  // Fase 2
  app.use('/vehicles', vehicleCatalogRoutes);

  // Fase 3
  app.use('/cars', carsRouter);
  app.use('/profiles', profileCarsRouter);

  // Fase 4
  app.use('/cars', carProjectRouter);
  app.use('/projects', projectsRouter);
  app.use('/projects', projectStepsRoutes);
  app.use('/cars', carModificationsRouter);
  app.use('/modifications', modificationsRouter);

  // Fase 5
  app.use('/feed', feedRouter);
  app.use('/posts', postsRouter);
  app.use('/profiles', profilePostsRouter);
  app.use('/cars', carPostsRouter);

  // Fase 6
  app.use('/posts', likesRoutes);
  app.use('/posts', postCommentsRouter);
  app.use('/comments', commentsRouter);
  app.use('/profiles', followsRoutes);
  // Salvar post: privado, por isso a listagem vive em /profile (do próprio
  // usuário) e não em /profiles/:username.
  app.use('/posts', postSaveRouter);
  app.use('/profile', savedPostsRouter);

  // Fase 7
  app.use('/notifications', notificationsRoutes);
  app.use('/push', pushSubscriptionsRouter);
  app.use('/search', searchRoutes);

  // Encontros/rolês
  app.use('/events', eventPostsRouter);
  app.use('/events', eventsRouter);
  app.use('/profiles', profileEventsRouter);
  app.use('/geocoding', geocodingRoutes);

  // Fase 8
  app.use('/advertisements', advertisementsRoutes);

  // Página de status da sessão de testes (não faz parte da API do produto).
  app.use('/status', statusRoutes);

  // Moderação: denunciar conteúdo e bloquear pessoas.
  app.use('/reports', reportsRouter);
  app.use('/profiles', blocksRouter);
  app.use('/profile', myBlocksRouter);

  /**
   * PWA servido pelo próprio backend, quando WEB_DIST_PATH aponta pro dist
   * do `expo export --platform web`.
   *
   * Mesma origem que a API de propósito: sem isso o navegador exige CORS
   * pra cada chamada, e a lista de origens permitidas viraria uma peça a
   * mais pra manter sempre que a URL do front mudasse.
   *
   * Vem depois de todas as rotas da API — o fallback abaixo devolve o
   * index.html pra qualquer caminho não-API, que é como uma SPA com rotas
   * de verdade (/event/abc) sobrevive a um F5.
   */
  if (env.WEB_DIST_PATH) {
    // Absoluto: res.sendFile recusa caminho relativo, e no Render o
    // WEB_DIST_PATH vem como "./web". Sem isto a landing responde 500 e só
    // as rotas servidas pelo express.static funcionam — falha torta, que
    // parece "só a home quebrada".
    const dist = path.resolve(env.WEB_DIST_PATH);

    /**
     * A raiz é a landing, não o app.
     *
     * Quem recebe o link nunca ouviu falar do Downpipe — abrir direto no
     * formulário de login pede uma conta antes de explicar qualquer coisa.
     * A landing é HTML estático: abre num piscar, contra os 4 MB de bundle
     * do app. Quem já tem sessão a própria página redireciona pra /app.
     */
    app.get('/', (_req, res) => res.sendFile(path.join(dist, 'landing.html')));

    /**
     * O app vive sob /app, e não na raiz.
     *
     * A home das abas do expo-router também é "/", então app e landing
     * disputariam o mesmo endereço — e o usuário logado entrava num
     * pinga-pinga entre os dois. O baseUrl do Expo resolve na origem: as
     * rotas e os assets já saem do build prefixados com /app.
     */
    /**
     * Cache dos arquivos que já têm hash no nome.
     *
     * entry-0cfca625.js muda de NOME a cada build e nunca muda de conteúdo,
     * então guardar pra sempre é seguro — e é o que faz a segunda abertura
     * do app ser instantânea em vez de rebaixar 785 KB de novo. O padrão do
     * express.static é max-age=0, que obriga a revalidar tudo toda vez.
     *
     * Só vale pra /_expo/static/: o HTML e o manifest continuam sem cache,
     * senão um deploy novo não chegaria em quem já abriu.
     */
    const cacheDosAssets = (res: Response, caminho: string) => {
      if (caminho.includes('_expo') && caminho.includes('static')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    };

    app.use('/app', express.static(dist, { extensions: ['html'], setHeaders: cacheDosAssets }));

    // Rota dinâmica (/app/event/abc) não tem HTML próprio: devolve a casca
    // e o expo-router resolve o caminho no navegador.
    app.get('/app/*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    app.get('/app', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

    // Assets soltos da landing e do PWA (logo, ícones, manifest, sw.js),
    // que moram na raiz de propósito: o service worker precisa estar em "/"
    // pra valer no site inteiro.
    // extensions: ['html'] pra /privacidade e /termos funcionarem sem o
    // ".html" no fim — são endereços que vão em loja de app e em e-mail,
    // e ninguém digita extensão.
    app.use(
      express.static(dist, { index: false, extensions: ['html'], setHeaders: cacheDosAssets })
    );

    /**
     * Página 404 para quem chegou pelo navegador.
     *
     * Antes qualquer endereço errado devolvia o JSON de erro da API na cara
     * da pessoa. Cliente de API continua recebendo JSON — a diferença é o
     * Accept do pedido, não o caminho.
     */
    app.use((req, res, next) => {
      // Exige "text/html" declarado, e não req.accepts(): com Accept: */*
      // — que é o que o fetch do app manda por padrão — o accepts() casa
      // com html e devolveria a página no lugar do JSON. Navegador sempre
      // declara text/html; cliente de API, quase nunca.
      const querHtml = (req.headers.accept ?? '').includes('text/html');
      if (req.method !== 'GET' || !querHtml) return next();
      res.status(404).sendFile(path.join(dist, '404.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
