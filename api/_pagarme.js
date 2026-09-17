// Cliente da API da Pagar.me (Stone): link de checkout para venda de
// varejo (cartão + Pix, cliente redirecionado) e cobrança Pix direta para
// cliente atacadista (QR code + copia-e-cola, sem sair do site). Mesmo
// padrão dos outros helpers `_` do projeto: nunca importa de src/,
// credenciais sempre lidas de process.env dentro das funções.
import crypto from 'node:crypto';

// A API v5 da Pagar.me usa uma URL base só - é a própria chave secreta
// (sk_test_... ou a de produção) que determina se as cobranças são de
// teste ou reais, não um subdomínio separado (diferente do Melhor Envio,
// que tem sandbox.melhorenvio.com.br de verdade).
const BASE_URL = 'https://api.pagar.me/core/v5';

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function getSecretKey() {
  const key = (process.env.PAGARME_SECRET_KEY || '').trim();
  if (!key) throw new Error('Pagar.me não configurada (PAGARME_SECRET_KEY ausente nas variáveis de ambiente da Vercel).');
  return key;
}

async function pagarmeFetch(path, { method = 'GET', body } = {}) {
  const auth = 'Basic ' + Buffer.from(`${getSecretKey()}:`).toString('base64');
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* resposta não era JSON */ }
  if (!res.ok) {
    const detail = data?.message || (data?.errors ? JSON.stringify(data.errors) : rawText) || `Erro ${res.status} na API da Pagar.me.`;
    throw new Error(`[${res.status}] ${detail}`.slice(0, 500));
  }
  return data;
}

function phonesFor(phone) {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return undefined;
  return { home_phone: { country_code: '55', area_code: digits.slice(0, 2), number: digits.slice(2) } };
}

// Link de checkout (venda de varejo): cartão + Pix, cliente é
// redirecionado pra pagar e volta pro site depois - mesmo papel que o
// link da InfinitePay tinha antes.
export async function createCheckoutLink({ order, redirectUrl }) {
  const totalCents = Math.round((order.total || 0) * 100);
  const totalPeças = (order.items || []).reduce((s, i) => s + i.qty, 0);

  const data = await pagarmeFetch('/paymentlinks', {
    method: 'POST',
    body: {
      type: 'order',
      name: `Pedido ${order.id}`,
      payment_settings: {
        accepted_payment_methods: ['credit_card', 'pix'],
        credit_card_settings: { operation_type: 'auth_and_capture', installments: [{ number: 1, total: totalCents }] },
      },
      cart_settings: {
        items: [{
          name: `Pedido ${order.id} — Gratitude Têxtil (${totalPeças} peça${totalPeças > 1 ? 's' : ''})`,
          amount: totalCents,
          default_quantity: 1,
        }],
      },
      flow_settings: { success_url: redirectUrl },
      metadata: { order_id: order.id },
    },
  });

  return { url: data.url, pagarmeId: data.id };
}

// Cobrança Pix direta (cliente atacadista): sem link/redirecionamento -
// devolve o QR code e o código copia-e-cola na hora, pra mostrar na
// própria página do pedido.
export async function createPixOrder({ order }) {
  const totalCents = Math.round((order.total || 0) * 100);
  const doc = onlyDigits(order.customer?.document);

  const data = await pagarmeFetch('/orders', {
    method: 'POST',
    body: {
      code: order.id,
      items: [{ amount: totalCents, description: `Pedido ${order.id} — Gratitude Têxtil`, quantity: 1 }],
      customer: {
        name: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Cliente',
        email: order.customer?.email || undefined,
        document: doc || undefined,
        type: doc.length === 14 ? 'company' : 'individual',
        phones: phonesFor(order.customer?.phone),
      },
      payments: [{ payment_method: 'pix', pix: { expires_in: 3600 } }],
      metadata: { order_id: order.id },
    },
  });

  const charge = data.charges?.[0];
  const tx = charge?.last_transaction || {};
  return {
    pagarmeId: data.id,
    qrCode: tx.qr_code || null,
    qrCodeUrl: tx.qr_code_url || null,
    expiresAt: tx.expires_at || null,
  };
}

// O webhook é autenticado por HTTP Basic Auth configurado no cadastro do
// endpoint no painel da Pagar.me (usuário/senha nossos, não relacionados à
// chave de API) - comparação em tempo constante pra evitar timing attack.
export function verifyWebhookAuth(req) {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;

  const expected = Buffer.from(`${user}:${pass}`);
  const received = Buffer.from(Buffer.from(header.slice(6), 'base64').toString('utf8'));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
