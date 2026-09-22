# Top Lanches API

API REST open source da Top Lanches, construída com Node.js, TypeScript, Fastify, Prisma e PostgreSQL. O backend é independente do frontend e concentra catálogo, horários, disponibilidade, autenticação administrativa, pedidos e integração opcional com a WhatsApp Business Platform (Cloud API).

## Visão geral

A API entrega os dados necessários para site, aplicativo ou painel administrativo. Preços oficiais são armazenados e calculados em centavos inteiros. O cliente nunca é fonte de verdade para total, subtotal ou preço de item. Cada item de pedido mantém snapshot de nome, slug e preço para preservar o histórico.

O seed contém exclusivamente os dados comerciais informados na especificação. A categoria `Garrafas` foi incluída porque o próprio seed fornecido contém Montilla 1 L, Dreher 1 L e Matuta 1 L sob esse agrupamento, apesar de ela não aparecer na lista anterior de categorias.

## Arquitetura

A aplicação separa HTTP, validação, serviços, persistência e regras de negócio:

- `src/modules`: domínio e rotas por contexto.
- `src/plugins`: JWT, CORS, segurança, rate limit, cache e Swagger.
- `src/database`: Prisma Client.
- `src/errors`: erro de aplicação e tratamento global.
- `src/utils`: dinheiro, slug, normalização, paginação e geração de links do WhatsApp.
- `src/modules/whatsapp`: webhook, assinatura, envio de texto/template e integração com a Cloud API.
- `prisma`: schema, migration e seed.
- `tests`: testes unitários e de integração.

O cache atual é simples e em memória, apenas para dados públicos de leitura frequente. Mutações administrativas invalidam o cache. Não existe dependência obrigatória de Redis.

## Tecnologias

- Node.js 22 LTS (22.12+) ou Node.js 24 LTS
- TypeScript com `strict: true`
- Fastify 5
- Prisma ORM 6
- PostgreSQL 16
- Zod
- Swagger / OpenAPI 3
- JWT
- Argon2id
- Docker e Docker Compose
- Vitest
- ESLint
- Prettier
- Luxon para timezone IANA
- PostgreSQL `unaccent` e `pg_trgm` para pesquisa

## Pré-requisitos

Para desenvolvimento local:

- Node.js 22 LTS (22.12+) ou Node.js 24 LTS
- npm
- PostgreSQL 16 ou Docker

Para executar a suíte de integração, Docker deve estar disponível porque Vitest usa Testcontainers para subir um PostgreSQL isolado.

## Instalação local

```bash
git clone <repositorio>
cd top-lanches-api
cp .env.example .env
npm install
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

A API ficará disponível em `http://localhost:3333`.

## Configuração do `.env`

Variáveis principais:

```dotenv
NODE_ENV=development
PORT=3333
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/top_lanches
JWT_SECRET=change-me-with-at-least-32-characters
JWT_EXPIRES_IN=1h
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_NAME=Administrador
CORS_ORIGINS=http://localhost:3000
BUSINESS_TIMEZONE=America/Fortaleza
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
LOGIN_RATE_LIMIT_MAX=5
ORDER_RATE_LIMIT_MAX=10
SEARCH_RATE_LIMIT_MAX=60
MAX_PAGE_LIMIT=100
CACHE_TTL_SECONDS=30
LOG_LEVEL=info
TRUST_PROXY=false

# WhatsApp Business Platform / Cloud API
WHATSAPP_CLOUD_ENABLED=false
WHATSAPP_GRAPH_API_VERSION=v26.0
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
WHATSAPP_DEFAULT_COUNTRY_CODE=55
WHATSAPP_WEBHOOK_RATE_LIMIT_MAX=1000
WHATSAPP_HTTP_TIMEOUT_MS=10000
```

O processo falha imediatamente se uma variável obrigatória for inválida. Em produção, `CORS_ORIGINS=*` é recusado.

## Docker

Subir banco e API em uma instalação nova:

```bash
cp .env.example .env
docker compose build api
docker compose up -d postgres
docker compose run --rm api sh -c "npx prisma migrate deploy && node dist/prisma/seed.js"
docker compose up -d api
```

O serviço `api` aguarda o healthcheck do PostgreSQL e executa `prisma migrate deploy` antes de iniciar o servidor. O seed é separado de propósito para não reexecutar inicialização de dados automaticamente em todo deploy. No container de produção, execute o seed compilado com `node dist/prisma/seed.js`; localmente, use `npm run prisma:seed`. O banco utiliza volume persistente.

## PostgreSQL e Prisma

Gerar o client:

```bash
npm run prisma:generate
```

Criar uma migration em desenvolvimento:

```bash
npm run prisma:migrate
```

Aplicar migrations existentes em produção:

```bash
npm run prisma:migrate:deploy
```

A migration inicial ativa `unaccent` e `pg_trgm` e cria índices para pesquisa aproximada.

## Seed

```bash
npm run prisma:seed
```

O seed é idempotente: registros existentes não são duplicados e alterações administrativas existentes não são sobrescritas. Ele cria, quando ausentes:

- estabelecimento e horários iniciais;
- três modalidades de atendimento;
- Pix e Dinheiro;
- categorias;
- 68 produtos fornecidos na especificação;
- configuração `acceptOrdersWhenClosed=false`;
- contador de pedidos;
- administrador inicial baseado em `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME`.

A senha administrativa é armazenada apenas como hash Argon2id.

## Executando

Desenvolvimento:

```bash
npm run dev
```

Build:

```bash
npm run build
npm start
```

## Testes

```bash
npm test
```

Os testes de integração usam Testcontainers e criam um PostgreSQL descartável. A suíte aplica migrations e seed automaticamente e cobre:

- `/health`;
- `/api/v1/menu`;
- listagem e paginação de produtos;
- busca sem acentos;
- criação e cálculo de pedidos;
- produto inexistente e indisponível;
- modalidade e pagamento inválidos;
- idempotência;
- login válido e inválido;
- proteção JWT;
- alteração de preço;
- preservação do preço histórico no `OrderItem`;
- verificação do webhook do WhatsApp;
- rejeição de assinatura HMAC inválida;
- proteção da configuração administrativa do WhatsApp;
- montagem de payloads de texto e templates sem inventar conteúdo;
- persistência e deduplicação de webhooks do WhatsApp;
- registro do Phone Number ID com PIN sem persistir o PIN.

Modo observação:

```bash
npm run test:watch
```

## Swagger

- Swagger UI: `http://localhost:3333/docs`
- JSON OpenAPI: `http://localhost:3333/docs/json`

A interface permite testar as rotas e autorizar endpoints administrativos com Bearer JWT.

## Rotas públicas

```text
GET  /health
GET  /api/v1
GET  /api/v1/business
GET  /api/v1/business/status
GET  /api/v1/hours
GET  /api/v1/service-modes
GET  /api/v1/payment-methods
GET  /api/v1/categories
GET  /api/v1/categories/:slug
GET  /api/v1/categories/:slug/products
GET  /api/v1/products
GET  /api/v1/products/featured
GET  /api/v1/products/:slug
GET  /api/v1/search?q=
GET  /api/v1/menu
POST /api/v1/orders
GET  /api/v1/orders/:id/whatsapp
GET  /api/v1/whatsapp/webhook
POST /api/v1/whatsapp/webhook
```

### Produtos e filtros

`GET /api/v1/products` aceita:

- `category`
- `available`
- `featured`
- `minPrice`
- `maxPrice`
- `search`
- `sort`
- `page`
- `limit`

Ordenações: `priority`, `name_asc`, `name_desc`, `price_asc`, `price_desc`, `newest`.

O limite global máximo de paginação é configurável e, por padrão, é 100.

### Pesquisa

A busca considera:

- nome do produto;
- nome da categoria;
- volume;
- termos relacionados cadastrados em `searchTerms` do produto ou categoria;
- similaridade trigram para pequenas diferenças de escrita.

A comparação é case-insensitive e accent-insensitive.

## Pedidos

Exemplo:

```json
{
  "customer": {
    "name": "João",
    "phone": "83999999999"
  },
  "serviceMode": "pickup",
  "paymentMethod": "PIX",
  "items": [
    {
      "productId": "uuid-do-produto",
      "quantity": 2
    }
  ],
  "notes": null
}
```

O backend busca o preço corrente no banco. Campos extras enviados dentro do item, inclusive `price`, não participam do cálculo.

Para Dinheiro, `cashChangeFor` é opcional. Quando fornecido, deve ser maior ou igual ao total calculado. Para Pix, esse campo é ignorado.

No presencial, nome e forma de pagamento são aceitos sem mesa e telefone não é obrigatório. Nenhum campo de mesa existe no modelo de pedido.

Para Delivery, um endereço estruturado pode ser enviado. A API não cria taxa de entrega automaticamente; `deliveryFeeInCents` permanece `null` nesta versão.

### Idempotência

Envie um header como:

```text
Idempotency-Key: checkout-9b24e640-...
```

A primeira requisição retorna `201`. Repetições da mesma chave retornam o mesmo pedido com `200`, sem criar duplicatas.

### Status

Status disponíveis:

```text
PENDING
CONFIRMED
PREPARING
READY
OUT_FOR_DELIVERY
COMPLETED
CANCELED
```

Transições inválidas são recusadas. `OUT_FOR_DELIVERY` só é aceito para pedidos `delivery`.

### WhatsApp

`GET /api/v1/orders/:id/whatsapp` continua apenas gerando `message` e `url`. A criação de um pedido não dispara mensagens automaticamente.

### WhatsApp Business Platform / Cloud API

A integração oficial é opcional e vem desativada no `.env.example`. Para habilitar:

1. Crie/configure um aplicativo na Meta com WhatsApp Business Platform.
2. Tenha uma WhatsApp Business Account (WABA) e um número de telefone registrado na Cloud API.
3. Crie um token de verificação próprio e informe-o em `WHATSAPP_VERIFY_TOKEN`.
4. Informe `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_WABA_ID`. O token usado para enviar mensagens precisa da permissão `whatsapp_business_messaging`; para assinar a WABA, use credencial com `whatsapp_business_management`.
5. Defina `WHATSAPP_CLOUD_ENABLED=true`.
6. Publique a API em HTTPS.
7. Na configuração de Webhooks da Meta, use como callback `https://SEU-DOMINIO/api/v1/whatsapp/webhook` e o mesmo valor de `WHATSAPP_VERIFY_TOKEN`.
8. Na área de Webhooks da Meta, assine o campo `messages`.
9. Depois do webhook validado, autentique-se no admin e execute `POST /api/v1/admin/whatsapp/subscriptions` uma vez para assinar o app na WABA configurada.
10. Se o número ainda precisar ser registrado na Cloud API, use `POST /api/v1/admin/whatsapp/phone/register` com o PIN de seis dígitos configurado para o número.

O `POST /api/v1/whatsapp/webhook` valida `X-Hub-Signature-256` com HMAC SHA-256 usando o App Secret antes de aceitar o evento. O corpo bruto é preservado apenas em memória para essa validação e não é persistido. A API persiste somente os campos operacionais extraídos (ID `wamid`, direção, telefone, tipo, texto quando houver, status e timestamp) e um hash SHA-256 do payload para deduplicar reentregas.

O webhook reconhece, deduplica e persiste mensagens recebidas e atualizações de status, mas **não responde automaticamente** nesta versão. Isso evita inventar um fluxo de atendimento. O comportamento do bot pode ser adicionado depois usando os serviços de catálogo, busca, horário e pedidos já existentes.

Envio manual protegido por JWT:

- `POST /api/v1/admin/whatsapp/messages/text`: envia texto;
- `POST /api/v1/admin/whatsapp/messages/template`: envia um template já aprovado na Meta;
- `POST /api/v1/admin/whatsapp/orders/:id/send`: envia manualmente o resumo de um pedido para o telefone cadastrado;
- `GET /api/v1/admin/whatsapp/status`: mostra apenas flags de configuração, sem revelar token ou segredo;
- `POST /api/v1/admin/whatsapp/subscriptions`: assina o aplicativo na WABA;
- `POST /api/v1/admin/whatsapp/phone/register`: registra o Phone Number ID usando um PIN de seis dígitos, sem persistir o PIN.

Telefones locais de 10 ou 11 dígitos recebem o DDI de `WHATSAPP_DEFAULT_COUNTRY_CODE` antes do envio. O padrão inicial é `55`; altere a variável se a operação mudar de país.

`WHATSAPP_GRAPH_API_VERSION` é configurável para permitir atualização da versão da Graph API sem mudança de código. Nesta revisão do projeto, o valor padrão é `v26.0`. `WHATSAPP_HTTP_TIMEOUT_MS` limita chamadas externas à Meta e evita requisições penduradas indefinidamente.

Um guia específico de configuração está em `docs/WHATSAPP-CLOUD-API.md`.

## Rotas administrativas

Exceto login, todas exigem `Authorization: Bearer <token>`.

```text
POST   /api/v1/admin/auth/login
GET    /api/v1/admin/business
PATCH  /api/v1/admin/business
GET    /api/v1/admin/hours
PUT    /api/v1/admin/hours
PATCH  /api/v1/admin/service-modes/:code
PATCH  /api/v1/admin/payment-methods/:code
GET    /api/v1/admin/categories
POST   /api/v1/admin/categories
PATCH  /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id
GET    /api/v1/admin/products
POST   /api/v1/admin/products
PATCH  /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id
GET    /api/v1/admin/orders
GET    /api/v1/admin/orders/:id
PATCH  /api/v1/admin/orders/:id/status
GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings
GET    /api/v1/admin/whatsapp/status
POST   /api/v1/admin/whatsapp/subscriptions
POST   /api/v1/admin/whatsapp/phone/register
POST   /api/v1/admin/whatsapp/messages/text
POST   /api/v1/admin/whatsapp/messages/template
POST   /api/v1/admin/whatsapp/orders/:id/send
```

`DELETE` de produtos e categorias implementa soft delete. Produtos usados em pedidos não são removidos fisicamente e pedidos antigos não são apagados.

## Autenticação

Login:

```json
{
  "email": "admin@example.com",
  "password": "change-me"
}
```

Resposta:

```json
{
  "accessToken": "...",
  "expiresIn": 3600
}
```

O JWT contém somente identificador, e-mail e nome do administrador. Senha e hash nunca são retornados.

## Erros e status HTTP

Erros de aplicação usam o mesmo envelope:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Produto não encontrado",
    "statusCode": 404,
    "requestId": "..."
  }
}
```

A API utiliza `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`, `502` e `503` conforme o caso. Entre os códigos de domínio estão `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `PRODUCT_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ORDER_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `INVALID_PAYMENT_METHOD`, `INVALID_SERVICE_MODE`, `INVALID_ORDER_STATUS`, `INVALID_STATUS_TRANSITION`, `BUSINESS_CLOSED`, `RATE_LIMIT_EXCEEDED`, `WHATSAPP_NOT_CONFIGURED`, `WHATSAPP_SIGNATURE_INVALID`, `WHATSAPP_API_ERROR` e `INTERNAL_SERVER_ERROR`.

## Imagens

O PostgreSQL armazena somente URLs. O contrato `ImageStorage` em `src/modules/products/image-storage.ts` define o ponto de extensão para Cloudflare R2, Amazon S3 ou Cloudinary.

MIME types aceitos pelo contrato:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/avif`

A primeira versão não adiciona upload binário à API e não guarda arquivos no banco.

## Cache

O cache em memória atende dados públicos como menu, estabelecimento e categorias. Mutações administrativas limpam o cache. A interface pode ser substituída por outra implementação no futuro sem adicionar Redis como dependência obrigatória agora.

## Segurança

- Helmet / headers de segurança.
- CORS por allowlist.
- rate limit global e limites específicos para login, pedido, busca e webhook do WhatsApp.
- Zod para validação de entrada.
- JWT nas rotas administrativas.
- Argon2id para senha.
- payload máximo de 1 MiB.
- Prisma e queries parametrizadas.
- preço oficial sempre recuperado do banco.
- cálculo monetário interno em centavos inteiros.
- logs com redaction de `Authorization` e cookies.
- validação HMAC SHA-256 da assinatura do webhook do WhatsApp antes do processamento;
- deduplicação de reentregas de webhook por hash SHA-256;
- timeout configurável nas chamadas da Graph API;
- tokens, App Secret e Verify Token do WhatsApp ficam somente em variáveis de ambiente e nunca são retornados pela API.
- stack trace não é retornada em produção.
- `X-Request-Id` aceito/gerado e devolvido em cada resposta.

## Logging

O logger nativo Pino do Fastify registra conclusão da requisição com:

- `requestId`
- `method`
- `route`
- `statusCode`
- `responseTime`

Tokens e segredos não são logados intencionalmente.

## Health check

`GET /health` executa uma consulta simples no PostgreSQL.

Saudável:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

Se o banco estiver indisponível, a API retorna HTTP `503`.

## Horários e timezone

Os períodos são persistidos no banco e podem existir múltiplos no mesmo dia. O cálculo de status usa o timezone configurado no estabelecimento, cujo seed inicial é `America/Fortaleza`, nunca o timezone do servidor.

Quando o próximo período é no mesmo dia, `nextOpeningAt` usa `HH:mm`. Quando a próxima abertura é em outro dia, retorna um ISO 8601 local com offset para remover ambiguidade.

## Deploy

Fluxo recomendado:

1. Defina `NODE_ENV=production`.
2. Use um `JWT_SECRET` forte e exclusivo.
3. Configure `DATABASE_URL` para PostgreSQL. O usuário de migration precisa conseguir criar (ou já encontrar instaladas) as extensões `unaccent` e `pg_trgm`.
4. Defina `CORS_ORIGINS` somente com origens autorizadas.
5. Rode `npm run prisma:migrate:deploy`.
6. Rode o seed somente quando quiser inserir dados iniciais ausentes.
7. Execute `npm run build` e `npm start`, ou utilize a imagem Docker.
8. Coloque a API atrás de TLS/reverse proxy em produção.
9. Se usar WhatsApp Cloud API, preencha as variáveis `WHATSAPP_*`, ative `WHATSAPP_CLOUD_ENABLED=true`, configure o callback HTTPS na Meta e assine o app na WABA.

## Scripts

```text
npm run dev
npm run build
npm start
npm test
npm run test:watch
npm run lint
npm run format
npm run format:check
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run verify
```

## Validação contínua no GitHub

O repositório inclui `.github/workflows/ci.yml`. Em cada `push` e `pull_request`, o GitHub Actions usa Node.js 22 e Docker para instalar as dependências, gerar o Prisma Client, compilar o TypeScript, executar o ESLint e rodar a suíte Vitest. Os testes de integração usam PostgreSQL real via Testcontainers.

Esse fluxo é a forma recomendada de confirmar em runtime que a API continua íntegra antes de um deploy.

## Licença

MIT. Consulte `LICENSE`.
