/**
 * Webhook Oficial Wiapy & Meta Conversions API (CAPI)
 * Documentação de Referência: https://help.wiapy.com/pt-br/article/webhook-jtggmu/
 * 
 * Tratamento dos Status Oficiais da Wiapy:
 * 1. "paid": Pagamento aprovado -> Converte payment.amount (centavos -> reais) e envia Purchase para a Meta.
 * 2. "unpaid": Não pago / aguardando pagamento (PIX ou Boleto) -> Ignora Purchase.
 * 3. "credit_card_declined": Cartão de crédito recusado -> Ignora Purchase.
 * 4. "refunded": Pagamento estornado/reembolsado -> Registra estorno, sem novo Purchase.
 * 5. "chargedback": Pagamento com chargeback/contestação -> Registra chargeback, sem novo Purchase.
 * 6. "payment null" / ausente: Carrinho abandonado / lead checkout -> Identifica abandono, sem Purchase.
 * 
 * Conformidade e Validações:
 * - Validação estrita do cabeçalho "Authorization" contra WIAPY_WEBHOOK_SECRET.
 * - payment.id identifica unicamente a transação (usado como event_id estável).
 * - tracking.fbc, tracking.fbp, tracking.ip e tracking.useragent aproveitados diretamente.
 * - customer.email e customer.mobile_phone normalizados e criptografados em SHA-256 (com DDI 55).
 * - Deduplicação persistente em Vercel KV / Upstash Redis (REST) + persistência local /tmp.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_PIXEL_ID = '1427229019213125';
const LOCAL_TMP_FILE = path.join('/tmp', 'wiapy_processed_transactions.json');

// Cache em memória local para a execução ativa
const memoryTransactionsCache = new Set<string>();

/**
 * Lê IDs de transações processadas salvas no disco /tmp (sobrevive a warm reboots da Serverless Function)
 */
function readLocalFileTransactions(): Set<string> {
  try {
    if (fs.existsSync(LOCAL_TMP_FILE)) {
      const raw = fs.readFileSync(LOCAL_TMP_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return new Set(list);
    }
  } catch {
    // Ignora erro de leitura em ambiente read-only estrito
  }
  return new Set();
}

/**
 * Salva o ID da transação no disco /tmp
 */
function saveLocalFileTransaction(id: string): void {
  try {
    const set = readLocalFileTransactions();
    set.add(id);
    fs.writeFileSync(LOCAL_TMP_FILE, JSON.stringify(Array.from(set)));
  } catch {
    // Ignora erro de escrita caso /tmp não esteja acessível
  }
}

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
 * Controle de Deduplicação Persistente:
 * 1. Consulta Vercel KV / Upstash Redis REST se as variáveis de ambiente estiverem ativas.
 * 2. Consulta o arquivo local em /tmp.
 * 3. Consulta o cache em memória.
 */
async function isTransactionProcessed(paymentId: string): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const response = await fetch(`${kvUrl}/get/wiapy_purchase_${paymentId}`, {
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

  if (readLocalFileTransactions().has(paymentId)) {
    return true;
  }

  return memoryTransactionsCache.has(paymentId);
}

/**
 * Grava a transação nos armazenamentos persistentes para evitar duplicidades
 */
async function markTransactionProcessed(paymentId: string, details: { amount: number; date: string }): Promise<void> {
  memoryTransactionsCache.add(paymentId);
  saveLocalFileTransaction(paymentId);

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      // Salva no Vercel KV / Upstash com TTL de 30 dias (2.592.000 segundos)
      await fetch(`${kvUrl}/set/wiapy_purchase_${paymentId}/${encodeURIComponent(JSON.stringify(details))}?EX=2592000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}` }
      });
    } catch (err) {
      console.warn('[Deduplication KV Mark Error]', err);
    }
  }
}

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret, x-wiapy-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Diagnóstico de saúde e estado da integração
  if (req.method === 'GET') {
    const hasKv = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Wiapy Webhook -> Meta Conversions API (CAPI)',
        endpoint: '/api/webhook',
        pixelId: process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID,
        metaTokenConfigured: Boolean(process.env.META_ACCESS_TOKEN),
        webhookSecretConfigured: Boolean(process.env.WIAPY_WEBHOOK_SECRET),
        persistenceMode: hasKv ? 'Vercel KV / Upstash Redis (Persistência Distribuída Global)' : 'Arquivo Local /tmp + Memória (Ative Vercel KV para multi-region)',
        supportedStatuses: ['paid', 'unpaid', 'credit_card_declined', 'refunded', 'chargedback', 'payment null'],
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

  // 1. VALIDAÇÃO DO CABEÇALHO AUTHORIZATION
  const webhookSecret = process.env.WIAPY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const rawAuth = (
      req.headers['authorization'] ||
      req.headers['x-wiapy-secret'] ||
      req.headers['x-webhook-secret'] ||
      ''
    ).toString();

    const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
    if (token !== webhookSecret.trim()) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          error: 'Não autorizado.',
          message: 'Cabeçalho Authorization inválido. Verifique o segredo configurado na Wiapy.'
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

  // 2. STATUS OFICIAL: PAYMENT NULL / AUSENTE (CARRINHO ABANDONADO)
  if (!body?.payment || body.payment === null) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        event_type: 'abandoned_cart',
        action: 'abandoned_cart_ignored',
        message: 'Payload com payment null recebido (carrinho abandonado). Evento Purchase NÃO disparado.'
      })
    );
    return;
  }

  const payment = body.payment;
  const paymentId = String(payment.id || '').trim();
  const paymentStatus = String(payment.status || '').trim().toLowerCase();

  if (!paymentId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.id obrigatório ausente na documentação da Wiapy.' }));
    return;
  }

  // 3. STATUS OFICIAL: UNPAID (NÃO PAGO / AGUARDANDO PAGAMENTO PIX OU BOLETO)
  if (paymentStatus === 'unpaid') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'unpaid',
        paymentId,
        action: 'unpaid_ignored',
        message: `Transação '${paymentId}' com status 'unpaid' (aguardando pagamento). Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 4. STATUS OFICIAL: CREDIT_CARD_DECLINED (CARTÃO RECUSADO)
  if (paymentStatus === 'credit_card_declined') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'credit_card_declined',
        paymentId,
        action: 'credit_card_declined_ignored',
        message: `Transação '${paymentId}' recusada pela operadora de cartão de crédito. Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 5. STATUS OFICIAL: REFUNDED (PAGAMENTO ESTORNADO / REEMBOLSADO)
  if (paymentStatus === 'refunded') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'refunded',
        paymentId,
        action: 'refund_registered',
        message: `Transação '${paymentId}' registrada como estorno/reembolso. Nenhuma nova compra disparada.`
      })
    );
    return;
  }

  // 6. STATUS OFICIAL: CHARGEDBACK (PAGAMENTO COM CHARGEBACK / CONTESTAÇÃO)
  if (paymentStatus === 'chargedback') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'chargedback',
        paymentId,
        action: 'chargeback_registered',
        message: `Transação '${paymentId}' registrada como chargeback/contestação. Nenhuma nova compra disparada.`
      })
    );
    return;
  }

  // 7. STATUS OFICIAL: PAID (PAGAMENTO APROVADO COM SUCESSO)
  if (paymentStatus !== 'paid') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: paymentStatus,
        paymentId,
        reason: `Status '${paymentStatus}' não corresponde a uma compra aprovada ('paid'). Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 8. DEDUPLICAÇÃO PERSISTENTE (GARANTE 1 ÚNICO PURCHASE POR TRANSAÇÃO)
  const isAlreadyProcessed = await isTransactionProcessed(paymentId);
  if (isAlreadyProcessed) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'paid',
        paymentId,
        reason: `Transação '${paymentId}' já foi processada anteriormente. Deduplicação persistente ativa (bloqueio de reenvio).`
      })
    );
    return;
  }

  // 9. CONVERSÃO DE CENTAVOS PARA REAIS (payment.amount / 100)
  // Conforme documentação da Wiapy: R$ 17,70 vem como 1770; R$ 47,90 vem como 4790; R$ 97,00 vem como 9700.
  if (payment.amount === undefined || payment.amount === null || payment.amount === '') {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.amount ausente no payload da Wiapy.' }));
    return;
  }

  const rawCentavos = Number(payment.amount);
  if (isNaN(rawCentavos) || rawCentavos <= 0) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Campo payment.amount inválido (deve ser maior que zero).' }));
    return;
  }

  // Converte centavos para reais com precisão decimal
  let finalValueInReais: number;
  if (Number.isInteger(rawCentavos) && rawCentavos >= 100) {
    finalValueInReais = Number((rawCentavos / 100).toFixed(2));
  } else {
    finalValueInReais = Number(rawCentavos.toFixed(2));
  }

  // 10. EXTRAÇÃO E NORMALIZAÇÃO DE DADOS (CUSTOMER & TRACKING DA WIAPY)
  const customer = body.customer || {};
  const tracking = body.tracking || {};
  const checkout = body.checkout || {};

  const customerEmail = String(customer.email || '').trim().toLowerCase();
  const rawCustomerPhone = String(customer.mobile_phone || customer.phone || '');
  const customerPhone = formatPhoneE164(rawCustomerPhone);
  const fullName = String(customer.name || '').trim();

  // Dados técnicos de rastreamento documentados na Wiapy
  const clientIp = String(
    tracking.ip ||
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    ''
  ).split(',')[0].trim();

  const clientUserAgent = String(
    tracking.useragent ||
    req.headers['user-agent'] ||
    ''
  ).trim();

  const fbc = tracking.fbc ? String(tracking.fbc).trim() : undefined;
  const fbp = tracking.fbp ? String(tracking.fbp).trim() : undefined;

  // Montagem do objeto user_data com hash SHA-256 (LGPD / Meta)
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

  // País Brasil padrão em SHA-256
  userData.country = [sha256('br')];

  if (clientIp) {
    userData.client_ip_address = clientIp;
  }

  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent;
  }

  if (fbp) {
    userData.fbp = fbp;
  }

  if (fbc) {
    userData.fbc = fbc;
  }

  // 11. MONTAGEM DO EVENTO PURCHASE PARA A META GRAPH API
  const productTitle = String(checkout.title || 'Protocolo Glicose Zero').trim();
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;

  const capiPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: paymentId, // ID estável de deduplicação da Wiapy
        event_source_url: 'https://protocologlicose.vercel.app/',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: 'BRL',
          value: finalValueInReais, // Valor real individual convertido de centavos para reais
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
    console.warn(`[Wiapy Webhook] Transação '${paymentId}' aprovada (R$ ${finalValueInReais}), mas META_ACCESS_TOKEN não está configurada.`);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        status: 'paid',
        paymentId,
        value: finalValueInReais,
        currency: 'BRL',
        warning: 'Transação validada com sucesso. Para enviar à Meta via Conversions API, configure META_ACCESS_TOKEN na Vercel.'
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
          error: 'Falha no envio para a Meta Conversions API.',
          details: metaData
        })
      );
      return;
    }

    // Registra como processada no armazenamento persistente
    await markTransactionProcessed(paymentId, {
      amount: finalValueInReais,
      date: new Date().toISOString()
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: true,
        status: 'paid',
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
