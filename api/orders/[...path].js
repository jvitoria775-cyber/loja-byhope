import { sql, handlePreflight, readJsonBody, sendJson, getPathSegments } from '../_db.js';
import { requireAuth } from '../_auth.js';

// Cobre /api/orders/:id e /api/orders/:id/confirm-payment (a rota base
// /api/orders vive em orders/index.js - o catch-all aqui só recebe
// caminhos com 1+ segmentos).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  const segments = getPathSegments(req, 'orders');

  if (segments.length === 1) return handleSingle(req, res, segments[0]);
  if (segments.length === 2 && segments[1] === 'confirm-payment') return handleConfirmPayment(req, res, segments[0]);
  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}

// GET: busca um pedido específico (público - usado pela página de
// confirmação após o pagamento, o próprio cliente lendo o pedido dele).
// PATCH: atualiza status de separação/envio e código de rastreio
// (protegido - só o painel administrativo).
async function handleSingle(req, res, id) {
  if (req.method === 'GET') {
    const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
    if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });
    return sendJson(res, 200, { order: rows[0].data });
  }

  if (req.method === 'PATCH') {
    if (!requireAuth(req, res)) return;
    const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
    if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

    const order = rows[0].data;
    const { fulfillmentStatus, trackingCode } = readJsonBody(req);

    if (fulfillmentStatus) {
      order.fulfillmentStatus = fulfillmentStatus;
      order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      order.statusHistory.push({ status: fulfillmentStatus, date: new Date().toISOString() });
      order.payment = order.payment || {};
      if (fulfillmentStatus === 'pago' || fulfillmentStatus === 'cancelado') {
        order.payment.status = fulfillmentStatus;
      }
    }
    if (typeof trackingCode === 'string') order.trackingCode = trackingCode;

    await sql`
      UPDATE orders SET
        data = ${JSON.stringify(order)}::jsonb,
        status = ${order.payment?.status || 'pendente'},
        fulfillment_status = ${order.fulfillmentStatus || 'pendente'},
        updated_at = now()
      WHERE id = ${id}
    `;
    return sendJson(res, 200, { order });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

// PATCH: marca um pedido como pago com os dados que a InfinitePay devolve
// no redirecionamento pós-pagamento. Público de propósito - é o próprio
// cliente confirmando o pagamento dele, sem estar logado como admin. Só
// mexe nos campos de pagamento - nunca em itens, endereço ou valores.
async function handleConfirmPayment(req, res, id) {
  if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Método não permitido.' });

  const { captureMethod, transactionNsu, receiptUrl } = readJsonBody(req);
  const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  const order = rows[0].data;
  order.payment = order.payment || {};
  order.payment.status = 'pago';
  if (captureMethod) order.payment.method = captureMethod;
  if (transactionNsu) order.payment.transactionNsu = transactionNsu;
  if (receiptUrl) order.payment.receiptUrl = receiptUrl;
  if (order.fulfillmentStatus !== 'enviado' && order.fulfillmentStatus !== 'cancelado') {
    order.fulfillmentStatus = 'pago';
  }
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'pago', date: new Date().toISOString() });

  await sql`
    UPDATE orders SET
      data = ${JSON.stringify(order)}::jsonb,
      status = 'pago',
      fulfillment_status = ${order.fulfillmentStatus},
      updated_at = now()
    WHERE id = ${id}
  `;
  return sendJson(res, 200, { order });
}
