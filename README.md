# Gearhead — Backend

API REST do **Gearhead**, rede social para entusiastas de carros. Construída em
TypeScript + Express, usando **Supabase** (Auth, Postgres, Storage) como
infraestrutura principal.

> Este README cobre **todas as 8 fases da especificação** (Supabase,
> Postgres, Migrations, Auth, Profiles, Catálogo de Veículos, Sincronização
> FIPE, Carros do usuário, Storage, Projetos, Etapas, Modificações,
> Estatísticas, Posts, Mídia, Feed, Likes, Comentários, Follows,
> Notificações, Busca, Anunciantes, Anúncios). O backend do MVP do Gearhead
> está funcionalmente completo conforme a especificação original.

## Stack

- TypeScript + Express
- Supabase (Auth, Postgres, Storage)
- Zod para validação de entrada
- Vitest para testes

## Estrutura do projeto

```
src/
├── config/            # env.ts, supabase.ts
├── database/
│   ├── migrations/    # arquivos .sql, aplicados em ordem
│   └── run-migrations.ts
├── modules/
│   ├── auth/             # register, login, logout, forgot-password
│   ├── profiles/         # profile/me, profiles/:username, upload de avatar
│   ├── vehicle-catalog/  # leitura pública do catálogo (brands/models/versions)
│   ├── vehicle-sync/     # sincronização com a API da FIPE (job, não HTTP)
│   ├── cars/             # CRUD de carros do usuário + upload de foto + estatísticas
│   ├── projects/         # projeto de preparação/restauração (1:1 com o carro)
│   ├── project-steps/    # etapas do projeto
│   ├── modifications/    # modificações registradas no carro
│   ├── posts/            # posts do feed + mídia (upload de imagens)
│   ├── likes/             # curtidas em posts
│   ├── comments/         # comentários em posts
│   ├── follows/          # seguidores / seguindo
│   ├── notifications/    # notificações in-app (like, comment, follow, project_update)
│   ├── search/           # busca combinada (usuários, carros, marcas, modelos)
│   └── advertisements/   # leitura de anúncios ativos (para interlear no feed)
├── shared/
│   ├── middleware/       # auth, error, pagination, upload (multer)
│   ├── storage/          # storage.service.ts (upload/remoção no Supabase Storage)
│   ├── utils/            # AppError, apiResponse
│   └── types/
├── app.ts
└── server.ts
```

Cada módulo segue o padrão: `schema (zod)` → `routes` → `controller` →
`service` (regra de negócio) → `repository` (acesso a dados).

## 1. Como instalar

```bash
npm install
```

## 2. Como configurar o Supabase

1. Crie um projeto em https://supabase.com.
2. Em **Settings → API**, copie:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha ao frontend)
3. Em **Settings → Database → Connection string** (modo "URI"), copie a
   connection string com a senha do banco → `DATABASE_URL`.
4. Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

## 3. Como configurar o banco / executar migrations

As migrations ficam em `src/database/migrations/*.sql` e são aplicadas em
ordem alfabética por um runner simples que usa `DATABASE_URL`:

```bash
npm run migrate
```

O runner registra cada migration aplicada em uma tabela `schema_migrations`,
então é seguro rodar o comando novamente — apenas as migrations pendentes
serão executadas.

A migration `0001_profiles.sql` já cria:

- a tabela `profiles`;
- um trigger que cria automaticamente um `profile` sempre que um novo usuário
  é criado em `auth.users` (via Supabase Auth);
- as políticas de Row Level Security (RLS): leitura pública, escrita restrita
  ao próprio usuário.

As migrations `0002_vehicle_catalog.sql` e `0003_vehicle_sync_logs.sql` criam:

- `vehicle_brands`, `vehicle_models`, `vehicle_versions` — base própria de
  veículos, com índices em `brand_id`, `model_id`, `year`, `fipe_code` e
  `name`, e RLS de leitura pública (escrita só via service role);
- `vehicle_sync_logs` — histórico de execuções do job de sincronização FIPE.

A migration `0004_cars.sql` cria:

- a tabela `cars` (carros do usuário, separados do catálogo de veículos),
  com RLS: leitura pública, escrita restrita ao dono (`owner_id`);
- os **buckets de Storage** `avatars`, `cars` e `posts` (públicos para
  leitura, limite de 5MB, apenas JPEG/PNG/WEBP);
- as policies de RLS de `storage.objects` que restringem escrita ao próprio
  usuário autenticado (o primeiro segmento do path do arquivo deve ser o
  `auth.uid()` de quem está enviando).

## 4. Como executar o seed (ambiente de desenvolvimento)

```bash
npm run seed
```

Advertisers/advertisements são o único domínio sem endpoints de escrita
nesta fase (a gestão de anúncios foi deixada para um painel futuro,
conforme a especificação: "não precisa implementar dashboard de anunciante
agora"). O seed cria um anunciante de exemplo com dois anúncios ativos, só
para permitir testar `GET /advertisements/active` localmente. O script
recusa rodar com `NODE_ENV=production`.

## 5. Como executar a sincronização FIPE

A sincronização em lote é um **script standalone**, feito para rodar via
cron/job externo — não é acionada automaticamente a cada request. Além
dela, os endpoints de leitura do catálogo (`GET /vehicles/*`) têm um
fallback "sob demanda": se a marca/modelo/ano pedido não estiver na base
própria ainda, o service busca só esse pedaço na FIPE, grava (mesmo upsert
por `fipe_code` do job batch, sem duplicar) e devolve — sem preço, pra não
gastar uma requisição extra por versão. Isso mantém o custo de rate limit
baixo (no pior caso, 1 requisição à FIPE por nível do cache-miss), mas
significa que essas rotas **podem**, sim, chamar a FIPE em tempo de
requisição quando a base local está vazia para aquele recorte. Preço/detalhe
de cada versão continua responsabilidade exclusiva do job batch com
`--with-prices`.

```bash
# Sincroniza a hierarquia marca -> modelo -> ano (sem buscar preço)
npm run sync:fipe

# Também busca o preço/detalhe de cada versão (1 requisição extra por versão)
npm run sync:fipe -- --with-prices

# Limita a N marcas (útil para testar localmente sem estourar o rate limit)
npm run sync:fipe -- --brand-limit=5
```

Cada execução:

- percorre marcas → modelos → anos na API pública da FIPE (parallelum);
- faz `upsert` em `vehicle_brands` / `vehicle_models` / `vehicle_versions`
  usando o código FIPE como chave de deduplicação (nunca duplica registros);
- registra início, fim, status e contadores (`processed`/`created`/`updated`)
  em `vehicle_sync_logs`.

**Atenção ao rate limit da FIPE**: o plano gratuito da API permite ~500
requisições/dia sem token (1000 com token gratuito). Uma sincronização
completa com `--with-prices` custa uma requisição por versão de cada modelo
de cada marca, o que pode ultrapassar esse limite facilmente. Recomendado:
rodar sem `--with-prices` na maioria das execuções (hierarquia apenas) e usar
`--with-prices` periodicamente, opcionalmente em lotes com `--brand-limit`.

Agende a execução via cron do seu ambiente de deploy (ex.: GitHub Actions
scheduled workflow, cron job da VPS, Supabase Edge Function agendada, etc.) —
isso não faz parte deste backend Express em si.

## 6. Como executar o projeto localmente

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou na porta definida em `PORT`).
Health check: `GET /health`.

## 7. Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública (respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa (uso exclusivo do backend) |
| `DATABASE_URL` | Connection string do Postgres, usada pelo runner de migrations |
| `FIPE_API_URL` | Base URL da API da FIPE (usada só pelo job de sincronização) |
| `PORT` | Porta HTTP do servidor (default `3000`) |
| `NODE_ENV` | `development` \| `test` \| `production` |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |

## 8. Endpoints disponíveis (Fase 1)

### Auth (proxy para Supabase Auth)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastro com e-mail + senha |
| POST | `/auth/login` | Login, retorna `session` (access/refresh token) |
| POST | `/auth/refresh` | Troca `refreshToken` por uma sessão nova (access token dura 1h) |
| POST | `/auth/logout` | Invalida a sessão atual |
| POST | `/auth/forgot-password` | Envia e-mail de recuperação de senha |

### Profiles

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/profile/me` | sim | Retorna o profile do usuário autenticado |
| PATCH | `/profile/me` | sim | Atualiza o próprio profile |
| GET | `/profiles/:username` | não | Retorna profile público + contadores |

### Catálogo de veículos (Fase 2)

Todos os endpoints abaixo são públicos e leem primariamente da base própria
(Postgres). `GET /vehicles/brands`, `/vehicles/brands/:brandId/models` e
`/vehicles/models/:modelId/years` têm um fallback: se a base local não tem
nada pra aquele recorte, populam sob demanda a partir da FIPE antes de
responder (ver seção 5) — os outros dois (`/search`, `/:id`) continuam
leitura pura da base local.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/vehicles/brands` | Lista todas as marcas |
| GET | `/vehicles/brands/:brandId/models` | Lista modelos de uma marca |
| GET | `/vehicles/models/:modelId/years` | Lista anos/versões de um modelo |
| GET | `/vehicles/search?q=` | Busca marcas e modelos por nome (paginado) |
| GET | `/vehicles/:id` | Detalhes de uma versão específica (com marca/modelo) |

### Carros (Fase 3)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/cars` | não | Lista carros (paginado, filtros `category`/`status`) |
| GET | `/cars/:id` | não | Detalhes de um carro |
| POST | `/cars` | sim | Cria um carro (`owner_id` sempre do usuário autenticado) |
| PATCH | `/cars/:id` | sim | Atualiza um carro (apenas o dono) |
| DELETE | `/cars/:id` | sim | Remove um carro (apenas o dono) |
| POST | `/cars/:id/photo` | sim | Upload da foto do carro (`multipart/form-data`, campo `file`) |
| GET | `/profiles/:username/cars` | não | Lista carros públicos de um usuário |
| POST | `/profile/me/avatar` | sim | Upload do avatar do usuário autenticado |

`project_progress` e `amount_invested` são campos derivados: não podem ser
definidos diretamente por `POST`/`PATCH` — a partir da Fase 4 serão
recalculados automaticamente com base nos projetos e modificações do carro.

### Projetos, etapas e modificações (Fase 4)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/cars/:carId/project` | não | Retorna o projeto do carro |
| POST | `/cars/:carId/project` | sim | Cria o projeto do carro (1 por carro) |
| PATCH | `/projects/:id` | sim | Atualiza o projeto (apenas o dono do carro) |
| DELETE | `/projects/:id` | sim | Remove o projeto (e suas etapas, em cascata) |
| GET | `/projects/:projectId/steps` | não | Lista as etapas do projeto |
| POST | `/projects/:projectId/steps` | sim | Cria uma etapa |
| PATCH | `/projects/:projectId/steps/:stepId` | sim | Atualiza uma etapa |
| DELETE | `/projects/:projectId/steps/:stepId` | sim | Remove uma etapa |
| GET | `/cars/:carId/modifications` | não | Lista modificações do carro |
| POST | `/cars/:carId/modifications` | sim | Cria uma modificação |
| PATCH | `/modifications/:id` | sim | Atualiza uma modificação |
| DELETE | `/modifications/:id` | sim | Remove uma modificação |
| GET | `/cars/:id/statistics` | não | Estatísticas agregadas do carro |

`budget_spent`, `modifications_total`, `modifications_done` (em `projects`)
e `amount_invested`/`project_progress` (em `cars`) são recalculados
automaticamente pelo backend a cada mutação em etapas/modificações — não
podem ser definidos diretamente pelo frontend.

### Posts, mídia e feed (Fase 5)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/feed` | opcional | Feed paginado (posts mais recentes) |
| GET | `/posts/:id` | opcional | Detalhes de um post |
| POST | `/posts` | sim | Cria um post (`multipart/form-data`, campo `files` p/ mídia) |
| PATCH | `/posts/:id` | sim | Atualiza campos de texto do post (apenas o autor) |
| DELETE | `/posts/:id` | sim | Remove o post e suas mídias (apenas o autor) |
| GET | `/profiles/:username/posts` | opcional | Posts de um usuário |
| GET | `/cars/:carId/posts` | opcional | Posts associados a um carro |

**Notas sobre a Fase 5:**

- O upload de mídia acontece na própria criação do post (`POST /posts`),
  via `multipart/form-data` com até 10 arquivos no campo `files`. Edição de
  mídia (adicionar/remover imagens de um post existente) fica para uma
  iteração futura — o MVP atual cobre a definição das mídias no momento da
  criação.
- `GET /feed` prioriza, na primeira página, posts recentes de quem o
  usuário autenticado segue, completando o restante com posts recentes em
  geral (sem duplicar) — de forma deliberadamente simples, sem algoritmo de
  recomendação. Sem autenticação, ou a partir da segunda página, o feed é
  apenas "mais recentes".
- `likesCount`, `commentsCount` e `likedByMe` agora refletem dados reais
  (calculados a partir de `post_likes` e `comments`, Fase 6).

### Curtidas, comentários e follows (Fase 6)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| POST | `/posts/:postId/like` | sim | Curte um post |
| DELETE | `/posts/:postId/like` | sim | Remove a curtida |
| GET | `/posts/:postId/likes` | não | Lista quem curtiu (paginado) |
| GET | `/posts/:postId/comments` | não | Lista comentários (paginado) |
| POST | `/posts/:postId/comments` | sim | Cria um comentário |
| PATCH | `/comments/:id` | sim | Edita um comentário (apenas o autor) |
| DELETE | `/comments/:id` | sim | Remove um comentário (apenas o autor) |
| POST | `/profiles/:userId/follow` | sim | Passa a seguir um usuário |
| DELETE | `/profiles/:userId/follow` | sim | Deixa de seguir um usuário |
| GET | `/profiles/:userId/followers` | não | Lista seguidores (paginado) |
| GET | `/profiles/:userId/following` | não | Lista quem o usuário segue (paginado) |

Regras aplicadas na camada de serviço (além da constraint `UNIQUE` e do
`CHECK (follower_id <> following_id)` no banco, como defesa em profundidade):
curtida duplicada retorna `409 ALREADY_LIKED`; seguir a si mesmo retorna
`422 VALIDATION_ERROR`; seguir quem já se segue retorna `409
ALREADY_FOLLOWING`. `GET /profiles/:username` agora retorna
`followersCount`, `followingCount`, `carsCount`, `projectsCount` e
`isFollowing` com dados reais (antes eram placeholders zerados).

### Notificações e busca (Fase 7)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/notifications` | sim | Lista as notificações do usuário (paginado, filtro `unreadOnly`) |
| GET | `/notifications/unread-count` | sim | Contagem de notificações não lidas |
| PATCH | `/notifications/:id/read` | sim | Marca uma notificação como lida |
| PATCH | `/notifications/read-all` | sim | Marca todas as notificações como lidas |
| GET | `/search?q=` | não | Busca combinada: usuários, carros, marcas, modelos |

**Notas sobre a Fase 7:**

- Notificações são criadas automaticamente pelo backend (nunca pelo
  frontend) quando alguém curte um post, comenta, começa a seguir, ou
  publica um post do tipo `project_update` (nesse caso, todos os
  seguidores do autor são notificados). Um usuário nunca recebe
  notificação da sua própria ação (ex.: comentar no próprio post) — isso é
  garantido na camada de serviço.
- A emissão de notificações nunca derruba a ação principal: se a escrita da
  notificação falhar, o erro é apenas logado — curtir/comentar/seguir/postar
  continuam funcionando normalmente.
- Push notifications não fazem parte desta fase, conforme a especificação —
  apenas a estrutura in-app (tabela + endpoints de leitura).
- `GET /search?q=` retorna cada categoria (usuários, carros, marcas,
  modelos) já agrupada e com um limite fixo (10 resultados cada), em vez de
  uma paginação global unificada — busca simples, sem ranking sofisticado,
  como pede a especificação.

### Anunciantes e anúncios (Fase 8)

| Método | Rota | Auth? | Descrição |
|---|---|---|---|
| GET | `/advertisements/active?limit=` | não | Anúncios ativos, dentro da janela de veiculação, para o app interlear no feed |

**Notas sobre a Fase 8:**

- Conforme a especificação, esta fase só estrutura o banco (`advertisers`,
  `advertisements`) e expõe leitura pública dos anúncios ativos — **não há
  dashboard de anunciante nem endpoints de escrita**. A criação/edição de
  anúncios acontece hoje via acesso direto ao banco (Supabase Studio) ou
  ficará para um painel administrativo futuro.
- `advertisers` não é exposta pela API em nenhum momento — só
  `advertisements`, e apenas os campos relevantes para o app renderizar o
  anúncio (`title`, `caption`, `imageUrl`, `ctaLabel`, `ctaUrl`).
- `ad_impressions`/`ad_clicks` (métricas de performance) ficam para uma
  fase futura, quando fizerem sentido — não fazem parte deste MVP.
- Um anúncio só é retornado por `GET /advertisements/active` se
  `status = 'active'` **e** a data atual estiver dentro de `starts_at`/
  `ends_at` (quando definidos) — essa janela é reforçada tanto na query do
  backend quanto na policy de RLS de `advertisements` (que já filtra por
  `status = 'active'`), como defesa em profundidade.

### Formato de resposta

Sucesso:

```json
{ "data": { }, "error": null }
```

Erro:

```json
{ "data": null, "error": { "code": "CAR_NOT_FOUND", "message": "Carro não encontrado" } }
```

Listas paginadas:

```json
{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 100, "hasNextPage": true }, "error": null }
```

## 9. Segurança

- `owner_id` / `author_id` / `user_id` **nunca** são lidos do corpo da
  requisição — sempre extraídos de `req.user.id`, populado pelo middleware
  `requireAuth` a partir do JWT validado pelo Supabase Auth.
- Row Level Security habilitada desde a primeira migration.
- A `service role key` só é usada no backend, nunca enviada ao app mobile.
- Upload de arquivos (`imageUpload`, baseado em multer) valida tipo
  (JPEG/PNG/WEBP) e tamanho (máx. 5MB) antes de chegar ao controller; o
  `storageService` valida novamente como defesa em profundidade e sempre
  grava o arquivo dentro de uma pasta cujo primeiro segmento é o
  `auth.uid()` do usuário — é isso que as policies de RLS de
  `storage.objects` exigem para permitir a escrita.

## 10. Testes

```bash
npm test
```

Cobertura atual: validação dos schemas Zod de todos os módulos (`auth`,
`profiles`, `vehicle-catalog`, `cars`, `projects`, `project-steps`,
`modifications`, `posts`, `comments`, `likes`, `follows`, `notifications`,
`search`, `advertisements` — incluindo a coerção de campos numéricos vindos
de `multipart/form-data` e de query strings), a lógica pura de recálculo de
agregados (`computeCarAggregates`), regras de negócio dos módulos `follows`
e `notifications` mockando os repositories (não pode seguir a si mesmo,
não pode seguir duas vezes, não pode deixar de seguir quem não segue,
notificação nunca derruba o fluxo principal em caso de falha, só o
destinatário pode marcar sua notificação como lida), o parser de preço da
FIPE (`parseFipePrice`), e utilitários do módulo de storage. Testes de
integração contra um projeto Supabase real ficam como próximo passo natural
(ex.: com um projeto Supabase local via `supabase start`, fora do escopo
deste MVP inicial).

## 11. Documentação da API (OpenAPI/Swagger)

Ainda não gerada — todos os endpoints estão documentados em prosa nas
seções acima. Um arquivo `openapi.yaml` é um bom próximo passo caso o
projeto cresça e precise de documentação interativa (Swagger UI) para
outros desenvolvedores/integrações.

## Status

As 8 fases da especificação original estão implementadas: autenticação,
perfis, catálogo de veículos com sincronização FIPE, carros com upload de
fotos, projetos/etapas/modificações com estatísticas recalculadas
automaticamente, posts com mídia e feed, curtidas/comentários/follows,
notificações in-app, busca, e a estrutura de anúncios para monetização
futura. Possíveis evoluções fora do escopo original (não implementadas):
login social (Google/Apple), push notifications, dashboard de anunciante,
métricas de impressão/clique de anúncio, documentação OpenAPI, e testes de
integração contra um banco real.
