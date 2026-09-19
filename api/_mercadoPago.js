// Cliente da API de Orders do Mercado Pago (Checkout Transparente): cartão
// de crédito/débito embutido no site via Payment Brick (varejo) e Pix
// direto sem redirecionamento (varejo quando escolhido no Brick, e sempre
// para o cliente atacadista). Substitui a Pagar.me, que teve um problema
// de autenticação nunca resolvido pelo suporte deles. Mesmo padrão dos
// outros helpers `_` do projeto: nunca importa de src/, credenciais
// sempre lidas de process.env dentro das funções.
import crypto from 'node:crypto';

const BASE_URL = 'https://api.mercadopago.com';

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function getAccessToken() {
  // .trim() por precaução - já tivemos espaço/quebra de linha acidental
  // colado numa variável de ambiente da Vercel mais de uma vez neste
  // projeto (Pagar.me, Melhor Envio), sempre com o mesmo sintoma confuso
  // de erro de autenticação genérico.
  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN ausente nas variáveis de ambiente da Vercel).');
  return token;
}

async function mpFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* resposta não era JSON */ }
  if (!res.ok) {
    const detail = data?.message || (data?.cause ? JSON.stringify(data.cause) : rawText) || `Erro ${res.status} na API do Mercado Pago.`;
    throw new Error(`[${res.status}] ${detail}`.slice(0, 500));
  }
  return data;
}

function payerFor(order) {
  const doc = onlyDigits(order.customer?.document);
  return {
    email: order.customer?.email || undefined,
    first_name: order.customer?.firstName || undefined,
    last_name: order.customer?.lastName || undefined,
    identification: doc ? { type: doc.length === 14 ? 'CNPJ' : 'CPF', number: doc } : undefined,
  };
}

// Pix (atacado sempre, varejo quando escolhido no Payment Brick) - sem
// token nenhum, é só o servidor pedindo direto pro Mercado Pago.
export async function createPixOrder({ order }) {
  const totalAmount = (Number(order.total) || 0).toFixed(2);

  const data = await mpFetch('/v1/orders', {
    method: 'POST',
    body: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: totalAmount,
      external_reference: order.id,
      payer: payerFor(order),
      transactions: {
        payments: [{
          amount: totalAmount,
          payment_method: { id: 'pix', type: 'bank_transfer' },
          expiration_time: 'PT30M',
        }],
      },
    },
  });

  const payment = data.transactions?.payments?.[0] || {};
  const pm = payment.payment_method || {};
  return {
    mpOrderId: data.id,
    status: data.status,
    qrCode: pm.qr_code || null,
    qrCodeBase64: pm.qr_code_base64 || null,
    ticketUrl: pm.ticket_url || null,
  };
}

// Cartão de crédito/débito (varejo, via Payment Brick embutido no
// checkout) - o token já vem pronto do formData que o Brick devolve no
// onSubmit (a Brick tokeniza o cartão no navegador do cliente, o número
// completo do cartão nunca passa pelo nosso servidor).
export async function createCardOrder({ order, formData }) {
  const totalAmount = (Number(order.total) || 0).toFixed(2);
  const isDebit = formData.payment_method_id?.startsWith('debit') || formData.payment_type_id === 'debit_card';

  const data = await mpFetch('/v1/orders', {
    method: 'POST',
    body: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: totalAmount,
      external_reference: order.id,
      payer: {
        ...payerFor(order),
        email: formData.payer?.email || order.customer?.email || undefined,
        identification: formData.payer?.identification || payerFor(order).identification,
      },
      transactions: {
        payments: [{
          amount: totalAmount,
          payment_method: {
            id: formData.payment_method_id,
            type: isDebit ? 'debit_card' : 'credit_card',
            token: formData.token,
            installments: formData.installments || 1,
            issuer_id: formData.issuer_id || undefined,
          },
        }],
      },
    },
  });

  const payment = data.transactions?.payments?.[0] || {};
  return {
    mpOrderId: data.id,
    status: data.status,
    paymentStatus: payment.status,
    statusDetail: payment.status_detail,
  };
}

// Busca autoritativa do estado do pedido direto na API (nunca confia só
// no corpo do webhook) - usado tanto pelo webhook quanto por uma
// eventual conferência manual.
export async function getOrder(mpOrderId) {
  return mpFetch(`/v1/orders/${mpOrderId}`);
}

// Validação da assinatura do webhook (cabeçalho x-signature: "ts=...,v1=...").
// Formato oficial: HMAC-SHA256 de "id:{data.id};request-id:{x-request-id};ts:{ts};"
// (o data.id precisa estar em minúsculas), comparado em tempo constante.
export function verifyWebhookSignature(req, dataId) {
  const secret = (process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) return false;

  const signatureHeader = req.headers['x-signature'] || '';
  const requestId = req.headers['x-request-id'] || '';
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.trim().split('=').map((s) => s.trim())).filter((p) => p.length === 2),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !dataId) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
