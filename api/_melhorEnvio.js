// Cliente da API do Melhor Envio (cotação e compra de frete via Correios).
// Guarda os tokens OAuth2 (access_token/refresh_token) na tabela settings,
// já que é o mesmo padrão "chave/valor JSONB" usado para todo o resto da
// configuração da loja - não precisa de tabela nova.
//
// Sandbox e produção são ambientes totalmente separados no Melhor Envio
// (contas, saldo e tokens diferentes) - trocar entre eles é só mudar a
// variável de ambiente MELHOR_ENVIO_ENV na Vercel.
import { sql } from './_db.js';

const ENV = (process.env.MELHOR_ENVIO_ENV || 'sandbox').toLowerCase();
const BASE_URL = ENV === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
const USER_AGENT = 'Gratitude Textil - integracao@gratitudetextil.com.br';

// Só Correios por enquanto, a pedido da loja - qualquer outra transportadora
// que a cotação devolva é descartada antes de chegar no checkout.
const CORREIOS_SERVICES = { 1: 'pac', 2: 'sedex' };
const SERVICE_LABELS = { 1: 'Correios PAC', 2: 'Correios SEDEX' };

// Peso padrão por categoria (kg) e caixa padrão da loja (cm) - editáveis
// em Configurações > Frete. Usados tanto na cotação do checkout quanto na
// compra real da etiqueta, para o valor cobrado do cliente bater com o
// valor debitado da carteira do Melhor Envio depois.
export const DEFAULT_CATEGORY_WEIGHTS_KG = {
  camiseta: 0.2, babylook: 0.15, cropped: 0.15, regata: 0.15, moletom: 0.6, short: 0.25,
};
export const DEFAULT_PACKAGE_DIMS = { width: 25, height: 20, length: 5 };

export function computeTotalWeightKg(items, categoryWeights) {
  const weights = { ...DEFAULT_CATEGORY_WEIGHTS_KG, ...(categoryWeights || {}) };
  return (items || []).reduce((sum, it) => sum + (Number(weights[it.category]) || 0.2) * (Number(it.qty) || 0), 0);
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function getClientCreds() {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Melhor Envio não configurado (MELHOR_ENVIO_CLIENT_ID/MELHOR_ENVIO_CLIENT_SECRET ausentes nas variáveis de ambiente da Vercel).');
  }
  return { clientId, clientSecret };
}

async function meFetch(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* resposta não era JSON */ }
  if (!res.ok) {
    const detail = data?.errors ? JSON.stringify(data.errors) : (data?.message || rawText || `Erro ${res.status} na API do Melhor Envio.`);
    throw new Error(`[${res.status}] ${detail}`.slice(0, 500));
  }
  return data;
}

// ---------- Conexão OAuth2 ----------

export function getOAuthAuthorizeUrl(redirectUri) {
  const { clientId } = getClientCreds();
  const url = new URL('/oauth/authorize', BASE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'cart-write shipping-calculate shipping-checkout shipping-generate shipping-print shipping-companies');
  return url.toString();
}

async function saveTokens(tokenResponse) {
  const expiresAt = new Date(Date.now() + (Number(tokenResponse.expires_in) || 2592000) * 1000).toISOString();
  const value = { accessToken: tokenResponse.access_token, refreshToken: tokenResponse.refresh_token, expiresAt };
  await sql`
    INSERT INTO settings (key, value) VALUES ('melhor_envio_auth', ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return value;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const { clientId, clientSecret } = getClientCreds();
  const data = await meFetch('/oauth/token', {
    method: 'POST',
    body: { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code },
  });
  return saveTokens(data);
}

async function refreshTokens(refreshToken) {
  const { clientId, clientSecret } = getClientCreds();
  const data = await meFetch('/oauth/token', {
    method: 'POST',
    body: { grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken },
  });
  return saveTokens(data);
}

export async function getConnectionStatus() {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'melhor_envio_auth'`;
  if (!rows.length || !rows[0].value?.accessToken) return { connected: false };
  return { connected: true, env: ENV, expiresAt: rows[0].value.expiresAt };
}

// Sempre confere a validade no banco antes de usar - nunca guarda o token
// em memória entre chamadas (cada requisição serverless é uma execução
// nova). Renova sozinho pelo refresh_token quando está perto de expirar.
async function getValidToken() {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'melhor_envio_auth'`;
  if (!rows.length || !rows[0].value?.accessToken) {
    throw new Error('Melhor Envio ainda não foi conectado. Acesse Configurações no painel para conectar.');
  }
  let auth = rows[0].value;
  const expiresAt = new Date(auth.expiresAt).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    if (!auth.refreshToken) throw new Error('A conexão com o Melhor Envio expirou. Reconecte em Configurações.');
    auth = await refreshTokens(auth.refreshToken);
  }
  return auth.accessToken;
}

// ---------- Frete ----------

// Cotação (checkout) e compra (pós-pagamento) usam o MESMO modelo de
// pacote (peso total + caixa padrão da loja), para que o valor cobrado do
// cliente no checkout bata com o valor realmente debitado da carteira ao
// comprar a etiqueta depois.
export async function calculateShipping({ fromCep, toCep, totalWeightKg, packageDims, insuranceValue }) {
  const token = await getValidToken();
  const data = await meFetch('/api/v2/me/shipment/calculate', {
    method: 'POST',
    token,
    body: {
      from: { postal_code: onlyDigits(fromCep) },
      to: { postal_code: onlyDigits(toCep) },
      volumes: [{
        width: Math.max(1, Math.round(packageDims.width)),
        height: Math.max(1, Math.round(packageDims.height)),
        length: Math.max(1, Math.round(packageDims.length)),
        weight: Math.max(0.01, totalWeightKg),
        insurance_value: Number(insuranceValue) || 0,
      }],
    },
  });

  return (Array.isArray(data) ? data : [])
    .filter((opt) => CORREIOS_SERVICES[opt.id] && !opt.error)
    .map((opt) => ({
      serviceId: opt.id,
      type: CORREIOS_SERVICES[opt.id],
      label: SERVICE_LABELS[opt.id],
      price: Number(opt.price),
      days: Number(opt.delivery_time ?? opt.custom_delivery_time ?? 0),
    }));
}

// Fluxo completo de compra de uma etiqueta: carrinho -> pagamento (debita
// a carteira do Melhor Envio) -> geração -> link de impressão (PDF já no
// formato padrão 10x15 deles). Lança erro em qualquer etapa que falhar -
// quem chama decide como tratar sem derrubar o resto do pedido.
export async function purchaseLabel({ order, from, packageDims, totalWeightKg }) {
  const token = await getValidToken();

  const addr = order.address || {};
  const toName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Cliente';

  const cartBody = {
    service: order.shipping?.serviceId,
    from: {
      name: from.name || 'Loja',
      phone: onlyDigits(from.phone),
      email: from.email || undefined,
      document: onlyDigits(from.cnpj) || undefined,
      address: from.street,
      number: from.number,
      district: from.district,
      city: from.city,
      postal_code: onlyDigits(from.cep),
      state_abbr: from.state,
      country_id: 'BR',
    },
    to: {
      name: toName,
      phone: onlyDigits(order.customer?.phone),
      email: order.customer?.email || undefined,
      address: addr.street,
      number: addr.number,
      complement: addr.complement || undefined,
      district: addr.neighborhood,
      city: addr.city,
      postal_code: onlyDigits(addr.cep),
      state_abbr: addr.state,
      country_id: 'BR',
    },
    products: (order.items || []).map((it) => ({
      name: `${it.name}-${it.color}-${it.size}`,
      quantity: String(it.qty),
      unitary_value: String(it.price),
    })),
    volumes: [{
      width: Math.max(1, Math.round(packageDims.width)),
      height: Math.max(1, Math.round(packageDims.height)),
      length: Math.max(1, Math.round(packageDims.length)),
      weight: Math.max(0.01, totalWeightKg),
    }],
    options: {
      insurance_value: Number(order.total) || 0,
      receipt: false,
      own_hand: false,
      non_commercial: true,
      platform: 'Gratitude Têxtil',
    },
  };

  const cartItem = await meFetch('/api/v2/me/cart', { method: 'POST', token, body: cartBody });
  const shipmentId = cartItem.id;
  if (!shipmentId) throw new Error('Melhor Envio não devolveu um identificador de envio ao adicionar ao carrinho.');

  await meFetch('/api/v2/me/shipment/checkout', { method: 'POST', token, body: { orders: [shipmentId] } });
  await meFetch('/api/v2/me/shipment/generate', { method: 'POST', token, body: { orders: [shipmentId] } });
  const printData = await meFetch('/api/v2/me/shipment/print', { method: 'POST', token, body: { mode: 'private', orders: [shipmentId] } });

  return {
    id: shipmentId,
    protocol: cartItem.protocol || null,
    trackingCode: cartItem.tracking || null,
    labelUrl: printData.url,
  };
}
