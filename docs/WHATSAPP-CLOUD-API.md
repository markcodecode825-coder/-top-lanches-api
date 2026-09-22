# Integração com WhatsApp Business Platform (Cloud API)

Este projeto integra a API da Top Lanches à **WhatsApp Business Platform / Cloud API da Meta**. O ZIP do projeto não é importado diretamente no aplicativo WhatsApp Business: a API precisa estar publicada em um servidor HTTPS e ser configurada como backend/webhook no aplicativo da Meta.

A integração vem desativada por padrão e não envia mensagens automaticamente ao criar pedidos.

## 1. O que já está implementado

- verificação `GET` do webhook da Meta;
- recebimento `POST` de eventos do campo `messages`;
- validação de `X-Hub-Signature-256` com HMAC SHA-256 e App Secret;
- deduplicação de reentregas do mesmo webhook;
- persistência de mensagens recebidas e status de entrega/leitura;
- envio administrativo de texto pela Cloud API;
- envio administrativo de templates já aprovados;
- envio manual do resumo de um pedido;
- assinatura do aplicativo na WABA;
- registro do Phone Number ID com PIN de seis dígitos;
- timeout configurável para chamadas à Graph API;
- credenciais somente por variáveis de ambiente;
- nenhuma resposta automática/bot inventada.

## 2. Variáveis de ambiente

Preencha no servidor:

```dotenv
WHATSAPP_CLOUD_ENABLED=true
WHATSAPP_GRAPH_API_VERSION=v26.0
WHATSAPP_VERIFY_TOKEN=gere-um-token-longo-e-aleatorio
WHATSAPP_APP_SECRET=app-secret-da-meta
WHATSAPP_ACCESS_TOKEN=token-de-acesso
WHATSAPP_PHONE_NUMBER_ID=id-do-numero
WHATSAPP_WABA_ID=id-da-waba
WHATSAPP_DEFAULT_COUNTRY_CODE=55
WHATSAPP_WEBHOOK_RATE_LIMIT_MAX=1000
WHATSAPP_HTTP_TIMEOUT_MS=10000
```

Não coloque essas credenciais no Git e não envie o App Secret, access token ou PIN em mensagens públicas.

Para produção, prefira credenciais adequadas de System User/Business Manager com as permissões necessárias para a operação. O envio usa `whatsapp_business_messaging`; operações de gerenciamento da WABA exigem permissões administrativas correspondentes, como `whatsapp_business_management`.

## 3. Publicar a API

A URL precisa ser pública e HTTPS. Depois do deploy, valide:

```text
GET https://SEU-DOMINIO/health
GET https://SEU-DOMINIO/docs
```

O callback que será informado à Meta é:

```text
https://SEU-DOMINIO/api/v1/whatsapp/webhook
```

## 4. Configurar o webhook na Meta

No aplicativo da Meta:

1. adicione/configure o produto WhatsApp;
2. abra a configuração de Webhooks do WhatsApp;
3. informe a URL de callback acima;
4. informe exatamente o mesmo valor de `WHATSAPP_VERIFY_TOKEN`;
5. conclua a verificação;
6. assine o campo `messages`.

Durante a verificação, a Meta chama:

```text
GET /api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

A API só devolve `hub.challenge` quando o token confere.

## 5. Assinar o aplicativo na WABA

Faça login administrativo:

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "seu-admin",
  "password": "sua-senha"
}
```

Use o JWT retornado:

```http
POST /api/v1/admin/whatsapp/subscriptions
Authorization: Bearer SEU_JWT_ADMIN
```

A API chama a Graph API em:

```text
POST /{WABA_ID}/subscribed_apps
```

## 6. Registrar o número quando necessário

Se o número ainda precisar ser registrado na Cloud API:

```http
POST /api/v1/admin/whatsapp/phone/register
Authorization: Bearer SEU_JWT_ADMIN
Content-Type: application/json

{
  "pin": "123456"
}
```

O PIN precisa ter seis dígitos. Ele é enviado à Meta e **não é salvo** no PostgreSQL.

## 7. Testar recebimento

Depois que o campo `messages` estiver assinado, envie uma mensagem para o número conectado. A Meta entregará o evento em:

```text
POST /api/v1/whatsapp/webhook
```

A assinatura do evento é validada antes do processamento. A API registra apenas os campos operacionais necessários e não salva o JSON bruto completo do webhook.

As tabelas técnicas usadas são:

- `WhatsappWebhookEvent`: hash do payload e contadores para deduplicação/auditoria;
- `WhatsappMessage`: `wamid`, direção, telefone, tipo, texto quando houver, template quando houver, status e timestamp do provedor.

## 8. Enviar uma mensagem de texto

```http
POST /api/v1/admin/whatsapp/messages/text
Authorization: Bearer SEU_JWT_ADMIN
Content-Type: application/json

{
  "to": "5583999999999",
  "text": "Mensagem de teste",
  "previewUrl": false
}
```

A API chama:

```text
POST /{PHONE_NUMBER_ID}/messages
```

O `wamid` retornado é salvo localmente. Mensagem de texto livre deve respeitar as regras vigentes de mensageria da Meta; quando um template for exigido, use o endpoint de template abaixo.

## 9. Enviar um template aprovado

```http
POST /api/v1/admin/whatsapp/messages/template
Authorization: Bearer SEU_JWT_ADMIN
Content-Type: application/json

{
  "to": "5583999999999",
  "templateName": "nome_exato_do_template_aprovado",
  "languageCode": "pt_BR"
}
```

A API não cria, renomeia nem presume templates. O nome informado precisa existir e estar aprovado na conta da Meta.

## 10. Enviar o resumo de um pedido

```http
POST /api/v1/admin/whatsapp/orders/UUID_DO_PEDIDO/send
Authorization: Bearer SEU_JWT_ADMIN
```

Esse disparo é **manual**. Criar um pedido em `POST /api/v1/orders` não envia WhatsApp automaticamente.

## 11. Conferir a configuração sem expor segredos

```http
GET /api/v1/admin/whatsapp/status
Authorization: Bearer SEU_JWT_ADMIN
```

A resposta informa apenas flags como `accessTokenConfigured` e `appSecretConfigured`. Os valores secretos nunca são retornados.

## 12. O que ainda não é um bot automático

A integração de transporte está pronta, mas nenhuma lógica de conversa foi inventada. Por exemplo, receber "cardápio" não gera uma resposta automática ainda.

Uma camada de atendimento pode ser adicionada depois para usar os módulos existentes de:

- status de funcionamento;
- cardápio;
- pesquisa;
- disponibilidade;
- criação de pedidos;
- consulta de pedidos.

Isso deve ser definido como um fluxo de negócio separado para não misturar conexão com WhatsApp e regras do atendimento.
