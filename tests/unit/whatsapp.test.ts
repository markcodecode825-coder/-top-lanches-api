import { describe, expect, it, vi } from 'vitest';
import {
  registerPhoneNumber,
  sendTemplateMessage,
  sendTextMessage,
  summarizeWebhook
} from '../../src/modules/whatsapp/service';

describe('WhatsApp Cloud API', () => {
  it('extrai mensagens e status de um webhook sem depender de campos não utilizados', () => {
    const summary = summarizeWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.inbound',
                    from: '5583999999999',
                    timestamp: '1758490000',
                    type: 'text',
                    text: { body: 'Cardápio' }
                  }
                ],
                statuses: [
                  {
                    id: 'wamid.outbound',
                    status: 'delivered',
                    timestamp: '1758490001',
                    recipient_id: '5583999999999'
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    expect(summary.object).toBe('whatsapp_business_account');
    expect(summary.messages[0]).toMatchObject({ type: 'text', text: 'Cardápio' });
    expect(summary.statuses[0]).toMatchObject({ status: 'delivered' });
  });

  it('envia texto usando Graph API v26.0 e acrescenta DDI padrão ao telefone local', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://graph.facebook.com/v26.0/1234567890/messages');
      const body = JSON.parse(String(init?.body)) as { to: string; type: string; text: { body: string } };
      expect(body.to).toBe('5583999999999');
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('Teste');
      return new Response(
        JSON.stringify({ contacts: [{ wa_id: '5583999999999' }], messages: [{ id: 'wamid.sent' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    const result = await sendTextMessage('83999999999', 'Teste', false, fetchMock as typeof fetch);
    expect(result).toEqual({ messageId: 'wamid.sent', recipientWaId: '5583999999999' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('envia template informado pelo administrador sem inventar nome ou conteúdo', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        type: string;
        template: { name: string; language: { code: string } };
      };
      expect(body.type).toBe('template');
      expect(body.template).toEqual({ name: 'pedido_pronto', language: { code: 'pt_BR' } });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.template' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const result = await sendTemplateMessage(
      '5583999999999',
      'pedido_pronto',
      'pt_BR',
      undefined,
      fetchMock as typeof fetch
    );
    expect(result.messageId).toBe('wamid.template');
  });

  it('registra o Phone Number ID enviando somente messaging_product e o PIN informado', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://graph.facebook.com/v26.0/1234567890/register');
      expect(JSON.parse(String(init?.body))).toEqual({ messaging_product: 'whatsapp', pin: '123456' });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    await expect(registerPhoneNumber('123456', fetchMock as typeof fetch)).resolves.toBe(true);
  });
});
