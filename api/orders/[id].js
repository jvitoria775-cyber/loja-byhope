import { sql, handlePreflight, readJsonBody, sendJson, getIdFromUrl } from '../_db.js';
import { requireAuth } from '../_auth.js';

// GET: busca um pedido específico (público - usado pela página de
// confirmação após o pagamento, o próprio cliente lendo o pedido dele).
// PATCH com { action: "confirm-payment" } no corpo: marca como pago com os
// dados que a InfinitePay devolve no redirecionamento (público de
// propósito - o cliente confirmando o próprio pagamento, sem estar logado
// como admin; só mexe nos campos de pagamento).
// PATCH sem essa ação: atualiza status de separação/envio e código de
// rastreio (protegido - só o painel administrativo).
// DELETE: remove o pedido definitivamente (protegido - usado quando o
// painel precisa apagar um pedido de teste/engano; não afeta estoque nem
// nenhum outro dado, já que o pedido não desconta estoque automaticamente).
//
// A "ação" vai dentro do corpo (JSON), não na query string da URL - nesse
// ambiente da Vercel (função Node "solta", sem Next.js), tanto os
// parâmetros de rota dinâmica quanto a query string de req.url não vêm
// preenchidos de forma confiável quando a rota é reescrita internamente;
// o corpo da requisição (req.body) é o único canal que se mostrou
// confiável nos testes.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  const id = getIdFromUrl(req);

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
    if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });
    return sendJson(res, 200, { order: rows[0].data });
  }

  if (req.method === 'PATCH') {
    const body = readJsonBody(req);
    if (body.action === 'confirm-payment') return handleConfirmPayment(res, id, body);
    return handleUpdate(req, res, id, body);
  }

  if (req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    await sql`DELETE FROM orders WHERE id = ${id}`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

async function handleUpdate(req, res, id, body) {
  if (!requireAuth(req, res)) return;
  const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  const order = rows[0].data;
  const { fulfillmentStatus, trackingCode } = body;

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

async function handleConfirmPayment(res, id, body) {
  const { captureMethod, transactionNsu, receiptUrl } = body;
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
