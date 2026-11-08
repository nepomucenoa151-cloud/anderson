/**
 * Webhook Oficial Wiapy & Meta Conversions API (CAPI)
 * Protocolo Glicose Zero — https://protocologlicose.vercel.app/
 * 
 * ETAPA 2, 3 e 4:
 * - Validação segura do cabeçalho Authorization via WIAPY_WEBHOOK_SECRET.
 * - Leitura dinâmica de payment.amount (em centavos) convertendo para reais (divisão por 100).
 * - NUNCA utiliza valores fixos: cada transação envia seu valor real (ex: R$ 47,90, R$ 97,00, R$ 37,90).
 * - Somente dispara evento Purchase quando payment.status for "paid".
 * - Tratamento específico para estornos/chargebacks, pagamentos pendentes e recusados.
 * - Deduplicação persistente via payment.id (event_id) com suporte a Vercel KV / Upstash Redis REST.
 * - user_data formatado segundo as especificações da Meta (SHA-256 em PII, DDI 55 no telefone, raw em fbc/fbp).
 */

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const DEFAULT_PIXEL_ID = '1427229019213125';

// Cache em memória local para a instância ativa da Serverless Function
const memoryTransactionsCache = new Set<string>();

/**
 * Hash SHA-256 padrão Meta (sempre minúsculo e sem espaços)
 */
function sha256(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Remove qualquer caractere que não seja dígito numérico
 */
function cleanDigits(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Remove acentos, caracteres especiais e converte para minúsculas
 */
function normalizeString(value: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formata telefone para o padrão internacional E.164:
 * Números brasileiros precisam do DDI 55 antes do DDD e número para match correto na Meta.
 */
function formatPhoneE164(phone: string): string {
  const digits = cleanDigits(phone);
  if (!digits) return '';

  // Se já tiver 12 ou 13 dígitos e começar com 55 (ex: 5511999999999)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  // Se tiver 10 ou 11 dígitos (DDD + número), adiciona o DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Verifica se a transação já foi processada anteriormente.
 * Prioridade:
 * 1. Vercel KV / Upstash Redis (persistente entre todas as instâncias serverless).
 * 2. Cache em memória da instância atual.
 */
async function isTransactionProcessed(paymentId: string): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const response = await fetch(`${kvUrl}/get/purchase_${paymentId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.result) return true;
      }
    } catch (err) {
      console.warn('[Deduplication KV Check Error]', err);
    }
  }

  return memoryTransactionsCache.has(paymentId);
}

/**
 * Registra a transação como processada para impedir duplicidades futuras.
 */
async function markTransactionProcessed(paymentId: string, details: { amount: number; date: string }): Promise<void> {
  memoryTransactionsCache.add(paymentId);

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      // TTL de 30 dias (2.592.000 segundos) para deduplicação contínua
      await fetch(`${kvUrl}/set/purchase_${paymentId}/${encodeURIComponent(JSON.stringify(details))}?EX=2592000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}` }
      });
    } catch (err) {
      console.warn('[Deduplication KV Mark Error]', err);
    }
  }
}

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  // Cabeçalhos de resposta
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret, x-wiapy-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Endpoint informativo e diagnóstico de saúde do Webhook
  if (req.method === 'GET') {
    const hasKv = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Wiapy Webhook -> Meta Conversions API (CAPI)',
        endpoint: '/api/webhook',
        pixelIdConfigured: process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID,
        metaTokenConfigured: Boolean(process.env.META_ACCESS_TOKEN),
        webhookSecretConfigured: Boolean(process.env.WIAPY_WEBHOOK_SECRET),
        persistentDeduplicationActive: hasKv,
        persistenceType: hasKv ? 'Vercel KV / Upstash Redis' : 'Memory Cache (Recomendado ativar Vercel KV)',
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

  // ==========================================
  // ETAPA 2: AUTENTICAÇÃO DO WEBHOOK WIAPY
  // ==========================================
  const configuredSecret = process.env.WIAPY_WEBHOOK_SECRET;
  if (configuredSecret) {
    const rawAuthHeader = (
      req.headers['authorization'] ||
      req.headers['x-wiapy-secret'] ||
      req.headers['x-webhook-secret'] ||
      ''
    ).toString();

    // Suporta tanto "Bearer <secret>" quanto o segredo direto no header
    const providedToken = rawAuthHeader.replace(/^Bearer\s+/i, '').trim();

    if (providedToken !== configuredSecret.trim()) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          error: 'Não autorizado.',
          message: 'Cabeçalho Authorization ou segredo do Webhook inválido.'
        })
      );
      return;
    }
  }

  // Leitura do corpo JSON da requisição
  let body: any = req.body;
  if (!body) {
    try {
      const buffers: Buffer[] = [];
      for await (const chunk of req) {
        buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(buffers).toString('utf-8');
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Payload JSON inválido.' }));
      return;
    }
  }

  // ==========================================
  // EXTRAÇÃO DOS CAMPOS DA WIAPY
  // ==========================================
  // Estrutura padrão Wiapy:
  // payment.id, payment.status, payment.amount, payment.payment_method, payment.type
  // customer.email, customer.mobile_phone, customer.name
  // tracking.ip, tracking.useragent, tracking.fbc, tracking.fbp
  // checkout.title
  const payment = body?.payment || {};
  const customer = body?.customer || {};
  const tracking = body?.tracking || {};
  const checkout = body?.checkout || {};

  const paymentId = String(payment?.id || body?.id || '').trim();
  const rawStatus = String(payment?.status || body?.status || '').trim().toLowerCase();

  if (!paymentId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.id obrigatório ausente no payload.' }));
    return;
  }

  // ==========================================
  // TRATAMENTO DE STATUS E SEGURANÇA
  // ==========================================
  // 1. Tratamento específico para Estornos e Chargebacks
  if (rawStatus === 'refunded' || rawStatus === 'chargeback' || rawStatus === 'reversed') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: rawStatus,
        paymentId,
        action: 'refund_registered',
        message: `Transação '${paymentId}' registrada como estorno/chargeback. Nenhuma compra disparada.`
      })
    );
    return;
  }

  // 2. Tratamento para Pagamento Pendente / Aguardando Pagamento (PIX / Boleto)
  if (rawStatus === 'pending' || rawStatus === 'waiting_payment') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: rawStatus,
        paymentId,
        action: 'pending_ignored',
        message: `Transação '${paymentId}' com status pendente. Aguardando aprovação real.`
      })
    );
    return;
  }

  // 3. Tratamento para Cartão Recusado, Cancelado ou Abandonado
  if (
    rawStatus === 'refused' ||
    rawStatus === 'declined' ||
    rawStatus === 'canceled' ||
    rawStatus === 'cancelled' ||
    rawStatus === 'abandoned'
  ) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: rawStatus,
        paymentId,
        action: 'refused_ignored',
        message: `Transação '${paymentId}' não foi aprovada (${rawStatus}). Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 4. Somente quando payment.status for "paid" (ou "approved")
  const isPaid = rawStatus === 'paid' || rawStatus === 'approved';
  if (!isPaid) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: rawStatus,
        paymentId,
        reason: `Status '${rawStatus}' não corresponde a uma compra aprovada. Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // ==========================================
  // ETAPA 4: DEDUPLICAÇÃO PERSISTENTE
  // ==========================================
  const alreadyProcessed = await isTransactionProcessed(paymentId);
  if (alreadyProcessed) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        paymentId,
        reason: `Transação '${paymentId}' já foi processada anteriormente. Deduplicação garantida (1 compra única por transação).`
      })
    );
    return;
  }

  // ==========================================
  // ETAPA 3: LEITURA E CONVERSÃO DO VALOR REAL
  // ==========================================
  // Lê payment.amount (em centavos) e converte para reais dividindo por 100.
  // NUNCA utiliza valores fixos pré-definidos no código.
  const rawPaymentAmount = payment?.amount ?? body?.amount;
  if (rawPaymentAmount === undefined || rawPaymentAmount === null || rawPaymentAmount === '') {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.amount ausente no payload.' }));
    return;
  }

  const numericCentavos = Number(rawPaymentAmount);
  if (isNaN(numericCentavos) || numericCentavos <= 0) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.amount inválido (deve ser numérico e maior que zero).' }));
    return;
  }

  // Se o valor vier em centavos inteiros (ex: 4790 para R$ 47,90 ou 9700 para R$ 97,00), divide por 100.
  // Se por ventura já vier fracionado em reais (ex: 47.90), preserva o número decimal.
  let finalValueInReais: number;
  if (Number.isInteger(numericCentavos) && numericCentavos >= 100) {
    finalValueInReais = Number((numericCentavos / 100).toFixed(2));
  } else {
    finalValueInReais = Number(numericCentavos.toFixed(2));
  }

  // ==========================================
  // ETAPA 3: DADOS DO CLIENTE & LGPD (SHA-256)
  // ==========================================
  const customerEmail = String(customer?.email || body?.email || '').trim().toLowerCase();
  const rawCustomerPhone = String(customer?.mobile_phone || customer?.phone || body?.mobile_phone || body?.phone || '');
  const customerPhone = formatPhoneE164(rawCustomerPhone);
  const fullName = String(customer?.name || body?.name || '').trim();

  // Dados de rastreamento do cliente
  const clientIp = String(
    tracking?.ip ||
    body?.ip ||
    customer?.ip ||
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    ''
  ).split(',')[0].trim();

  const clientUserAgent = String(
    tracking?.useragent ||
    tracking?.user_agent ||
    body?.useragent ||
    req.headers['user-agent'] ||
    ''
  ).trim();

  const fbc = tracking?.fbc || body?.fbc || undefined;
  const fbp = tracking?.fbp || body?.fbp || undefined;

  // Montagem do user_data conforme especificações estritas da Meta
  const userData: Record<string, any> = {};

  if (customerEmail) {
    userData.em = [sha256(customerEmail)];
  }

  if (customerPhone) {
    userData.ph = [sha256(customerPhone)];
  }

  if (fullName) {
    const parts = fullName.split(/\s+/);
    if (parts[0]) {
      userData.fn = [sha256(normalizeString(parts[0]))];
    }
    if (parts.length > 1) {
      userData.ln = [sha256(normalizeString(parts.slice(1).join(' ')))];
    }
  }

  // DDI do Brasil para todos os compradores nacionais
  userData.country = [sha256('br')];

  if (clientIp) {
    userData.client_ip_address = clientIp;
  }

  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent;
  }

  if (fbp) {
    userData.fbp = String(fbp);
  }

  if (fbc) {
    userData.fbc = String(fbc);
  }

  // ==========================================
  // ETAPA 3: PAYLOAD CONVERSIONS API (META)
  // ==========================================
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;
  const productTitle = String(checkout?.title || body?.product?.name || 'Protocolo Glicose Zero').trim();

  const capiPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: paymentId, // Identificador único e estável para deduplicação
        event_source_url: 'https://protocologlicose.vercel.app/',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: 'BRL',
          value: finalValueInReais, // Valor real individual da transação (sem valor fixo)
          content_name: productTitle,
          content_type: 'product',
          content_ids: ['protocolo-glicose-zero'],
          order_id: paymentId
        }
      }
    ]
  };

  // Se o token da Meta não estiver configurado na Vercel
  if (!metaAccessToken) {
    await markTransactionProcessed(paymentId, { amount: finalValueInReais, date: new Date().toISOString() });
    console.warn(`[Wiapy Webhook] Transação '${paymentId}' aprovada (R$ ${finalValueInReais}), mas META_ACCESS_TOKEN não está configurada na Vercel.`);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        paymentId,
        value: finalValueInReais,
        currency: 'BRL',
        warning: 'Transação validada com sucesso. Para enviar à Meta via Conversions API, configure a variável META_ACCESS_TOKEN nas configurações da Vercel.'
      })
    );
    return;
  }

  // Disparo para a Meta Graph API v21.0
  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${metaAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiPayload)
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('[Meta CAPI Error]', metaData);
      res.statusCode = 502;
      res.end(
        JSON.stringify({
          error: 'Erro no retorno da Meta Conversions API.',
          details: metaData
        })
      );
      return;
    }

    // Registra como processado no armazenamento persistente
    await markTransactionProcessed(paymentId, {
      amount: finalValueInReais,
      date: new Date().toISOString()
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: true,
        paymentId,
        value: finalValueInReais,
        currency: 'BRL',
        eventsReceived: metaData?.events_received || 1,
        fbtraceId: metaData?.fbtrace_id
      })
    );
  } catch (error: any) {
    console.error('[Meta CAPI Network Error]', error);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: 'Erro de conexão ao enviar evento para a Meta.',
        message: error?.message
      })
    );
  }
}
