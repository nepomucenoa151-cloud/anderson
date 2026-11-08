/**
 * Webhook de Confirmação Real de Pagamento & Meta Conversions API (CAPI)
 * 
 * Auditoria Avançada & Conformidade com Especificações Meta e LGPD:
 * 1. Somente dispara Purchase quando o pagamento estiver 100% aprovado/pago pelo gateway.
 * 2. Bloqueia pagamentos pendentes, cancelados, recusados ou reembolsados.
 * 3. Deduplicação via event_id único (ID da transação/pedido) entre Pixel e CAPI.
 * 4. Elevação da Qualidade de Correspondência de Eventos (EMQ):
 *    - ph: Formatação internacional E.164 com DDI Brasil (+55) antes do hash SHA-256.
 *    - fn e ln: Separação de Primeiro Nome e Sobrenome, remoção de acentos e hash SHA-256.
 *    - ct, st, zp, country: Normalização de endereço e hash SHA-256.
 *    - external_id: Hash SHA-256 do CPF/documento ou ID único do cliente.
 *    - fbp e fbc: Cookies de rastreamento do Facebook preservados em formato raw string.
 *    - client_ip_address e client_user_agent: Extração do IP real e User Agent do comprador.
 * 5. Proteção de credenciais: Token de acesso da Meta (CAPI) mantido restrito ao backend.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

const DEFAULT_PIXEL_ID = '1427229019213125';

// Cache em memória para deduplicação durante a vida da instância serverless
const processedTransactions = new Set<string>();

/**
 * Hash SHA-256 padrão Meta (sempre minúsculo e sem espaços)
 */
function sha256(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Remove qualquer caractere não numérico
 */
function cleanDigits(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Remove acentos, caracteres especiais e normaliza para minúsculas
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
 * Formata telefone para o padrão internacional E.164 exigido pela Meta:
 * Números brasileiros precisam do DDI 55 antes do DDD e número para match correto.
 */
function formatPhoneE164(phone: string): string {
  const digits = cleanDigits(phone);
  if (!digits) return '';

  // Se já tem 12 ou 13 dígitos e começa com 55 (ex: 5511999999999)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  // Se tem 10 ou 11 dígitos (DDD + telefone), adiciona 55 do Brasil
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Endpoint de status e diagnóstico de CAPI
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Protocolo Glicose Zero - Meta Conversions API Webhook',
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

  // 1. IDENTIFICAÇÃO DO STATUS DA TRANSAÇÃO
  // Mapeia todas as possíveis chaves de status das plataformas de pagamento (Wiapy, Kiwify, Hotmart, Eduzz, Kirvano)
  const rawStatus = (
    body?.status ||
    body?.event ||
    body?.order_status ||
    body?.transaction_status ||
    body?.data?.status ||
    body?.data?.event ||
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
    rawStatus === 'payment.succeeded' ||
    rawStatus === 'pix_paid';

  // Se NÃO for pagamento aprovado, ignora imediatamente para não gerar compras falsas
  if (!isApproved) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        reason: `Status '${rawStatus || 'desconhecido'}' não é um pagamento aprovado. Evento Purchase NÃO disparado.`
      })
    );
    return;
  }

  // 2. EXTRAÇÃO DO ID ÚNICO PARA DEDUPLICAÇÃO (event_id)
  const orderId = String(
    body?.id ||
    body?.order_id ||
    body?.transaction_id ||
    body?.code ||
    body?.data?.id ||
    body?.order?.id ||
    `order_${Date.now()}`
  );

  // Evita reprocessamento duplicado do mesmo pedido
  if (processedTransactions.has(orderId)) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        reason: `Pedido '${orderId}' já foi processado anteriormente (Deduplicação garantida).`
      })
    );
    return;
  }

  // 3. EXTRAÇÃO ROBUSTA DE DADOS DO CLIENTE & ENDEREÇO
  const customer = body?.customer || body?.buyer || body?.client || body?.data?.customer || {};
  const address = customer?.address || body?.address || body?.data?.address || {};

  const customerEmail = (customer?.email || body?.email || '').trim().toLowerCase();
  const rawPhone = customer?.phone || customer?.cellphone || customer?.mobile || body?.phone || '';
  const customerPhone = formatPhoneE164(rawPhone);
  const fullName = (customer?.name || body?.name || '').trim();

  // Documento (CPF) para identificador externo único
  const customerDoc = cleanDigits(customer?.document || customer?.cpf || body?.cpf || body?.document || '');

  // Dados de localização
  const city = normalizeString(address?.city || customer?.city || body?.city || '');
  const state = (address?.state || address?.uf || customer?.state || customer?.uf || body?.state || '').trim().toLowerCase().slice(0, 2);
  const zipCode = cleanDigits(address?.zip_code || address?.zipcode || address?.cep || customer?.cep || body?.cep || '');
  const country = 'br';

  // Valor da compra
  const rawAmount = body?.amount || body?.value || body?.total || body?.data?.amount || 37.90;
  const numericAmount = Number(rawAmount) > 1000 && Number(rawAmount) % 100 === 0 ? Number(rawAmount) / 100 : Number(rawAmount);
  const finalValue = numericAmount > 0 ? numericAmount : 37.90;

  // Tracking e Cookies do Facebook
  const tracking = body?.tracking || body?.custom_data || body?.data?.tracking || {};
  const fbp = tracking?.fbp || body?.fbp || customer?.fbp || undefined;
  const fbc = tracking?.fbc || body?.fbc || customer?.fbc || (body?.fbclid ? `fb.1.${Date.now()}.${body.fbclid}` : undefined);

  // IP e User Agent reais do cliente
  const clientIp = (
    customer?.ip ||
    tracking?.client_ip ||
    body?.ip ||
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    ''
  ).toString().split(',')[0].trim();

  const clientUserAgent = (
    customer?.user_agent ||
    tracking?.user_agent ||
    body?.user_agent ||
    req.headers['user-agent'] ||
    ''
  ).toString();

  // 4. CONSTRUÇÃO DO OBJETO user_data FORMATADO E HASHED EM SHA-256 (LGPD COMPLIANT)
  const userData: Record<string, any> = {};

  if (customerEmail) {
    userData.em = [sha256(customerEmail)];
  }

  if (customerPhone) {
    userData.ph = [sha256(customerPhone)];
  }

  if (fullName) {
    const nameParts = fullName.split(/\s+/);
    if (nameParts[0]) {
      userData.fn = [sha256(normalizeString(nameParts[0]))];
    }
    if (nameParts.length > 1) {
      userData.ln = [sha256(normalizeString(nameParts.slice(1).join(' ')))];
    }
  }

  if (customerDoc) {
    userData.external_id = [sha256(customerDoc)];
  }

  if (city) {
    userData.ct = [sha256(city)];
  }

  if (state) {
    userData.st = [sha256(state)];
  }

  if (zipCode) {
    userData.zp = [sha256(zipCode)];
  }

  userData.country = [sha256(country)];

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

  // 5. VERIFICAÇÃO DE CREDENCIAIS DA CONVERSIONS API
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;

  if (!metaAccessToken) {
    processedTransactions.add(orderId);
    console.warn(
      `[Meta CAPI] Pagamento aprovado para o pedido '${orderId}', mas META_ACCESS_TOKEN não está configurada na Vercel.`
    );
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        received: true,
        dispatched: false,
        orderId,
        warning: 'Pagamento aprovado recebido. Para enviar à Meta via Conversions API, configure META_ACCESS_TOKEN na Vercel.'
      })
    );
    return;
  }

  // 6. PAYLOAD CONVERSIONS API (CAPI) COM PARÂMETROS OBRIGATÓRIOS DA META
  const capiEvent = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: orderId, // Chave única de deduplicação
    event_source_url: 'https://protocologlicose.vercel.app/',
    action_source: 'website',
    user_data: userData,
    custom_data: {
      currency: 'BRL',
      value: finalValue,
      content_name: 'Protocolo Glicose Zero - Pacote Completo',
      content_type: 'product',
      content_ids: ['protocolo-glicose-zero-37'],
      order_id: orderId
    }
  };

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${metaAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [capiEvent] })
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
