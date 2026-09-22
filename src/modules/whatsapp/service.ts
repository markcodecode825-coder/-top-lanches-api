import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';

export interface WhatsAppWebhookMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text: string | null;
}

export interface WhatsAppWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipientId: string | null;
}

export interface WhatsAppWebhookSummary {
  object: string | null;
  messages: WhatsAppWebhookMessage[];
  statuses: WhatsAppWebhookStatus[];
}

export interface WhatsAppSendResult {
  messageId: string | null;
  recipientWaId: string | null;
}

interface GraphMessageResponse {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string }>;
}

interface GraphSuccessResponse {
  success?: boolean | string;
}

function assertWhatsAppConfigured(): void {
  if (!env.WHATSAPP_CLOUD_ENABLED) {
    throw new AppError('WHATSAPP_NOT_CONFIGURED', 503, 'Integração com WhatsApp Cloud API está desativada');
  }
}

export function normalizePhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '');
  const normalized =
    digits.startsWith(env.WHATSAPP_DEFAULT_COUNTRY_CODE) || (digits.length !== 10 && digits.length !== 11)
      ? digits
      : `${env.WHATSAPP_DEFAULT_COUNTRY_CODE}${digits}`;

  if (!/^\d{10,15}$/.test(normalized)) {
    throw new AppError('VALIDATION_ERROR', 422, 'Telefone inválido para envio pelo WhatsApp');
  }
  return normalized;
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${path}`;
}

async function graphFetch(
  input: string,
  init: RequestInit,
  fetchImpl: typeof fetch
): Promise<Response> {
  try {
    return await fetchImpl(input, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(env.WHATSAPP_HTTP_TIMEOUT_MS)
    });
  } catch (error) {
    const type = error instanceof Error ? error.name : typeof error;
    throw new AppError('WHATSAPP_API_ERROR', 502, 'Não foi possível comunicar com a Meta', {
      provider: 'Meta Graph API',
      errorType: type
    });
  }
}

async function parseGraphResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new AppError('WHATSAPP_API_ERROR', 502, 'A Meta recusou a operação do WhatsApp', {
      providerStatus: response.status
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new AppError('WHATSAPP_API_ERROR', 502, 'Resposta inválida recebida da Meta');
  }
}

function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookChallenge(mode: string, verifyToken: string): boolean {
  assertWhatsAppConfigured();
  return mode === 'subscribe' && safeEqualText(verifyToken, env.WHATSAPP_VERIFY_TOKEN);
}

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  assertWhatsAppConfigured();
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const receivedHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;

  const expected = createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest();
  const received = Buffer.from(receivedHex, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function summarizeWebhook(payload: unknown): WhatsAppWebhookSummary {
  const summary: WhatsAppWebhookSummary = { object: null, messages: [], statuses: [] };
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return summary;

  const root = payload as Record<string, unknown>;
  summary.object = typeof root.object === 'string' ? root.object : null;
  if (!Array.isArray(root.entry)) return summary;

  for (const entry of root.entry) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const changes = (entry as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (typeof change !== 'object' || change === null || Array.isArray(change)) continue;
      const value = (change as Record<string, unknown>).value;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const valueObject = value as Record<string, unknown>;

      if (Array.isArray(valueObject.messages)) {
        for (const message of valueObject.messages) {
          if (typeof message !== 'object' || message === null || Array.isArray(message)) continue;
          const messageObject = message as Record<string, unknown>;
          const textObject =
            typeof messageObject.text === 'object' && messageObject.text !== null && !Array.isArray(messageObject.text)
              ? (messageObject.text as Record<string, unknown>)
              : null;
          const id = typeof messageObject.id === 'string' ? messageObject.id : '';
          const from = typeof messageObject.from === 'string' ? messageObject.from : '';
          const timestamp = typeof messageObject.timestamp === 'string' ? messageObject.timestamp : '';
          const type = typeof messageObject.type === 'string' ? messageObject.type : 'unknown';
          if (!id || !from) continue;

          summary.messages.push({
            id,
            from,
            timestamp,
            type,
            text: typeof textObject?.body === 'string' ? textObject.body : null
          });
        }
      }

      if (Array.isArray(valueObject.statuses)) {
        for (const status of valueObject.statuses) {
          if (typeof status !== 'object' || status === null || Array.isArray(status)) continue;
          const statusObject = status as Record<string, unknown>;
          const id = typeof statusObject.id === 'string' ? statusObject.id : '';
          const statusName = typeof statusObject.status === 'string' ? statusObject.status : '';
          if (!id || !statusName) continue;

          summary.statuses.push({
            id,
            status: statusName,
            timestamp: typeof statusObject.timestamp === 'string' ? statusObject.timestamp : '',
            recipientId: typeof statusObject.recipient_id === 'string' ? statusObject.recipient_id : null
          });
        }
      }
    }
  }

  return summary;
}

export async function sendTextMessage(
  to: string,
  text: string,
  previewUrl = false,
  fetchImpl: typeof fetch = fetch
): Promise<WhatsAppSendResult> {
  assertWhatsAppConfigured();
  const normalizedTo = normalizePhoneForWhatsApp(to);

  const response = await graphFetch(
    graphUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: { preview_url: previewUrl, body: text }
      })
    },
    fetchImpl
  );

  const data = await parseGraphResponse<GraphMessageResponse>(response);
  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new AppError('WHATSAPP_API_ERROR', 502, 'A Meta aceitou a requisição sem retornar o identificador da mensagem');
  }
  return {
    messageId,
    recipientWaId: data.contacts?.[0]?.wa_id ?? normalizedTo
  };
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components: Array<Record<string, unknown>> | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<WhatsAppSendResult> {
  assertWhatsAppConfigured();
  const normalizedTo = normalizePhoneForWhatsApp(to);

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: languageCode }
  };
  if (components !== undefined) template.components = components;

  const response = await graphFetch(
    graphUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'template',
        template
      })
    },
    fetchImpl
  );

  const data = await parseGraphResponse<GraphMessageResponse>(response);
  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new AppError('WHATSAPP_API_ERROR', 502, 'A Meta aceitou a requisição sem retornar o identificador da mensagem');
  }
  return {
    messageId,
    recipientWaId: data.contacts?.[0]?.wa_id ?? normalizedTo
  };
}

export async function registerPhoneNumber(pin: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  assertWhatsAppConfigured();
  if (!/^\d{6}$/.test(pin)) {
    throw new AppError('VALIDATION_ERROR', 422, 'PIN deve conter exatamente 6 dígitos');
  }

  const response = await graphFetch(
    graphUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/register`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin })
    },
    fetchImpl
  );

  const data = await parseGraphResponse<GraphSuccessResponse>(response);
  return data.success === true || data.success === 'true';
}

export async function subscribeAppToWaba(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  assertWhatsAppConfigured();

  const response = await graphFetch(
    graphUrl(`${env.WHATSAPP_WABA_ID}/subscribed_apps`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      }
    },
    fetchImpl
  );

  const data = await parseGraphResponse<GraphSuccessResponse>(response);
  return data.success === true || data.success === 'true';
}

export function getWhatsAppConfigurationStatus() {
  return {
    enabled: env.WHATSAPP_CLOUD_ENABLED,
    botEnabled: env.WHATSAPP_BOT_ENABLED,
    botSessionTtlMinutes: env.WHATSAPP_BOT_SESSION_TTL_MINUTES,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
    httpTimeoutMs: env.WHATSAPP_HTTP_TIMEOUT_MS,
    phoneNumberIdConfigured: env.WHATSAPP_PHONE_NUMBER_ID.length > 0,
    wabaIdConfigured: env.WHATSAPP_WABA_ID.length > 0,
    accessTokenConfigured: env.WHATSAPP_ACCESS_TOKEN.length > 0,
    appSecretConfigured: env.WHATSAPP_APP_SECRET.length > 0,
    verifyTokenConfigured: env.WHATSAPP_VERIFY_TOKEN.length > 0
  };
}
