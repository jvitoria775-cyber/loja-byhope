import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { createCheckoutLink, createPixOrder, verifyWebhookAuth } from './_pagarme.js';
import { maybeAutoPurchaseLabel } from './_melhorEnvio.js';

// Substitui api/create-payment-link.js (InfinitePay) - mesma vaga no
// orçamento de funções serverless do plano gratuito da Vercel.
//
// POST { action: 'create-checkout-link', orderId, redirectUrl } - público,
// venda de varejo: cria um link Pagar.me (cartão + Pix) pro pedido já
// salvo em /api/orders, cliente é redirecionado pra pagar.
// POST { action: 'create-pix-charge', orderId } - público, cliente
// atacadista: cria uma cobrança Pix direta (sem redirecionamento) pro
// pedido já salvo, devolve QR code + copia-e-cola pra mostrar na própria
// página do pedido.
// POST sem "action" - webhook da Pagar.me (autenticado por Basic Auth
// configurado no painel deles, não pela chave de API): confirma o
// pagamento e dispara a geração automática da etiqueta.
//
// Em ambos os casos de criação de cobrança, o valor/itens/cliente vêm do
// PEDIDO JÁ SALVO no banco (buscado por orderId), nunca de dados soltos
// que o navegador mandasse na hora - assim ninguém consegue manipular o
// valor cobrado alterando a requisição.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const body = readJsonBody(req);

  if (body.action === 'create-checkout-link') return handleCreateCheckoutLink(res, body);
  if (body.action === 'create-pix-charge') return handleCreatePixCharge(res, body);
  if (!body.action) return handleWebhook(req, res, body);

  return sendJson(res, 400, { error: 'Ação inválida.' });
}

async function loadOrder(id) {
  const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
  return rows.length ? rows[0].data : null;
}

async function saveOrder(order) {
  await sql`UPDATE orders SET data = ${JSON.stringify(order)}::jsonb, updated_at = now() WHERE id = ${order.id}`;
}

async function handleCreateCheckoutLink(res, body) {
  const { orderId, redirectUrl } = body;
  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  try {
    const { url, pagarmeId } = await createCheckoutLink({ order, redirectUrl });
    order.payment = order.payment || {};
    order.payment.pagarmeId = pagarmeId;
    await saveOrder(order);
    return sendJson(res, 200, { url });
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Não foi possível gerar o link de pagamento.' });
  }
}

async function handleCreatePixCharge(res, body) {
  const { orderId } = body;
  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 404, { error: 'Pedido não encontrado.' });
  if (!order.customer?.document) {
    return sendJson(res, 400, { error: 'CPF/CNPJ do cliente é obrigatório para gerar a cobrança Pix.' });
  }

  try {
    const { pagarmeId, qrCode, qrCodeUrl, expiresAt } = await createPixOrder({ order });
    order.payment = order.payment || {};
    order.payment.pagarmeId = pagarmeId;
    order.payment.pixQrCode = qrCode;
    order.payment.pixQrCodeUrl = qrCodeUrl;
    order.payment.pixExpiresAt = expiresAt;
    await saveOrder(order);
    return sendJson(res, 200, { qrCode, qrCodeUrl, expiresAt });
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Não foi possível gerar a cobrança Pix.' });
  }
}

// A Pagar.me ainda não nos deu um webhook real pra conferir o formato
// exato do payload - a extração abaixo tenta os caminhos mais prováveis
// (documentados como "order.paid"/"charge.paid", com o pedido em
// `data`) e deve ser ajustada assim que virem eventos de verdade em
// teste, do mesmo jeito que os campos do Melhor Envio foram corrigidos na
// prática nesta mesma sessão.
async function handleWebhook(req, res, body) {
  if (!verifyWebhookAuth(req)) return sendJson(res, 401, { error: 'Não autorizado.' });

  const eventType = body.type || body.event;
  const eventData = body.data?.object || body.data || {};
  const isPaid = eventType === 'order.paid' || eventType === 'charge.paid';
  const isFailed = eventType === 'order.payment_failed' || eventType === 'charge.payment_failed';
  if (!isPaid && !isFailed) return sendJson(res, 200, { ok: true, ignored: eventType });

  const orderId = eventData.code || eventData.metadata?.order_id || eventData.order?.code;
  if (!orderId) return sendJson(res, 200, { ok: true, warning: 'Evento sem referência de pedido.' });

  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 200, { ok: true, warning: 'Pedido não encontrado para este evento.' });

  order.payment = order.payment || {};
  if (isPaid) {
    order.payment.status = 'pago';
    if (order.fulfillmentStatus !== 'enviado' && order.fulfillmentStatus !== 'cancelado') {
      order.fulfillmentStatus = 'pago';
    }
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push({ status: 'pago', date: new Date().toISOString() });
    await maybeAutoPurchaseLabel(order);
  } else {
    order.payment.status = 'cancelado';
  }

  await sql`
    UPDATE orders SET
      data = ${JSON.stringify(order)}::jsonb,
      status = ${order.payment.status},
      fulfillment_status = ${order.fulfillmentStatus || 'pendente'},
      updated_at = now()
    WHERE id = ${order.id}
  `;
  return sendJson(res, 200, { ok: true });
}
