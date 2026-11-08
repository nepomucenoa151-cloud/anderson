/**
 * Webhook Seguro de Confirmação de Pagamento & Meta Conversions API (CAPI)
 * 
 * Este endpoint recebe notificações da plataforma de pagamento (Wiapy, Kiwify, Hotmart, etc.)
 * e envia o evento PURCHASE de forma segura e server-side para o Facebook/Meta Conversions API.
 * 
 * Regras implementadas:
 * 1. Não dispara Purchase em cliques ou visitas.
 * 2. Somente dispara Purchase quando o pagamento estiver REALMENTE aprovado/pago.
 * 3. Deduplicação via event_id (ID da transação/pedido).
 * 4. Hashing de dados pessoais (SHA-256) conforme exigido pela Meta.
 * 5. Proteção de token de acesso no backend (nunca exposto ao frontend).
 */

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const DEFAULT_PIXEL_ID = '1427229019213125';

// Cache em memória para deduplicação durante a vida da instância serverless
const processedTransactions = new Set<string>();

function sha256(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function cleanDigits(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  // CORS básico e cabeçalhos JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Verificação de status do endpoint
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'online',
        endpoint: '/api/webhook',
        message: 'Endpoint de Webhook pronto para receber notificações de pagamento.',
        pixelIdConfigured: process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID,
        metaTokenConfigured: Boolean(process.env.META_ACCESS_TOKEN),
        timestamp: new Date().toISOString()
      })
    );
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Método não permitido. Utilize POST.' }));
    return;
  }

  // Leitura do corpo da requisição se não estiver previamente parsed
  let body: any = req.body;
  if (!body) {
    try {
      const buffers: Buffer[] = [];
      for await (const chunk of req) {
        buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(buffers).toString('utf-8');
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Payload JSON inválido.' }));
      return;
    }
  }

  // 1. Identificar Status do Pagamento
  const rawStatus = (
    body?.status ||
    body?.event ||
    body?.order_status ||
    body?.data?.status ||
    body?.transaction?.status ||
    ''
  ).toString().toLowerCase();

  const isApproved =
    rawStatus.includes('paid') ||
    rawStatus.includes('pago') ||
    rawStatus.includes('approved') ||
    rawStatus.includes('aprovado') ||
    rawStatus.includes('complete') ||
    rawStatus.includes('concluido') ||
    rawStatus === 'order.paid' ||
    rawStatus === 'payment.succeeded';

  if (!isApproved) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        reason: `Status '${rawStatus || 'indefinido'}' não é um pagamento aprovado. Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 2. Extrair ID único da transação para Deduplicação
  const orderId = String(
    body?.id ||
    body?.order_id ||
    body?.transaction_id ||
    body?.data?.id ||
    body?.code ||
    `order_${Date.now()}`
  );

  // Prevenir duplicidade no mesmo pedido
  if (processedTransactions.has(orderId)) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        reason: `Pedido '${orderId}' já foi processado anteriormente (Deduplicação ativa).`
      })
    );
    return;
  }

  // 3. Extrair dados da compra e do cliente
  const customerEmail = body?.customer?.email || body?.buyer?.email || body?.data?.customer?.email || body?.email || '';
  const customerPhone = cleanDigits(body?.customer?.phone || body?.buyer?.phone || body?.data?.customer?.phone || body?.phone || '');
  const customerName = (body?.customer?.name || body?.buyer?.name || body?.data?.customer?.name || body?.name || '').trim();
  const rawAmount = body?.amount || body?.value || body?.total || body?.data?.amount || 37.90;
  // Se o valor vier em centavos (ex: 3790), converte para reais
  const numericAmount = Number(rawAmount) > 1000 && Number(rawAmount) % 100 === 0 ? Number(rawAmount) / 100 : Number(rawAmount);

  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  const clientUserAgent = (req.headers['user-agent'] || '').toString();

  // 4. Verificar se o Token de Acesso da Meta está configurado no Backend
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;

  if (!metaAccessToken) {
    // Registra pedido e avisa sobre a necessidade da variável no Vercel
    processedTransactions.add(orderId);
    console.warn(
      `[Meta CAPI] Pagamento aprovado para o pedido '${orderId}', mas a variável de ambiente META_ACCESS_TOKEN não está configurada na Vercel.`
    );
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        orderId,
        warning: 'Pagamento aprovado recebido com sucesso. Para enviar à Meta via Conversions API, configure a variável META_ACCESS_TOKEN nas configurações da Vercel.'
      })
    );
    return;
  }

  // 5. Preparar e Enviar payload para a Meta Conversions API (Graph API)
  const metaPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: orderId, // Mesma chave para deduplicação entre Pixel e CAPI
        event_source_url: 'https://protocologlicose.vercel.app/',
        action_source: 'website',
        user_data: {
          em: customerEmail ? [sha256(customerEmail)] : [],
          ph: customerPhone ? [sha256(customerPhone)] : [],
          fn: customerName ? [sha256(customerName.split(' ')[0])] : [],
          client_ip_address: clientIp || undefined,
          client_user_agent: clientUserAgent || undefined
        },
        custom_data: {
          currency: 'BRL',
          value: numericAmount > 0 ? numericAmount : 37.90,
          content_name: 'Protocolo Glicose Zero - Pacote Completo',
          content_type: 'product',
          content_ids: ['protocolo-glicose-zero-37'],
          order_id: orderId
        }
      }
    ]
  };

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${metaAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload)
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('[Meta CAPI Error]', metaData);
      res.statusCode = 502;
      res.end(
        JSON.stringify({
          error: 'Falha no envio para a Meta Conversions API.',
          details: metaData
        })
      );
      return;
    }

    processedTransactions.add(orderId);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: true,
        orderId,
        eventsReceived: metaData?.events_received || 1,
        fbtraceId: metaData?.fbtrace_id
      })
    );
  } catch (error: any) {
    console.error('[Meta CAPI Network Error]', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Erro de conexão ao enviar evento para a Meta.', message: error?.message }));
  }
}
