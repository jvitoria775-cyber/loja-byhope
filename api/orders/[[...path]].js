import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

// Rota "catch-all" cobrindo /api/orders, /api/orders/:id e
// /api/orders/:id/confirm-payment num único arquivo - o plano gratuito da
// Vercel permite no máximo 12 Serverless Functions por deploy, então
// agrupamos rotas relacionadas em vez de um arquivo por endpoint.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  const segments = [].concat(req.query.path || []);

  if (segments.length === 0) return handleCollection(req, res);
  if (segments.length === 1) return handleSingle(req, res, segments[0]);
  if (segments.length === 2 && segments[1] === 'confirm-payment') return handleConfirmPayment(req, res, segments[0]);
  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}

// GET: lista todos os pedidos (protegido - só o painel administrativo).
// POST: cria um novo pedido (público - usado pelo checkout da loja e pelo
// PDV; qualquer cliente precisa poder registrar o próprio pedido).
async function handleCollection(req, res) {
  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    const { rows } = await sql`SELECT data FROM orders ORDER BY created_at DESC`;
    return sendJson(res, 200, { orders: rows.map((r) => r.data) });
  }

  if (req.method === 'POST') {
    const order = readJsonBody(req);
    if (!order.id || !Array.isArray(order.items) || !order.items.length) {
      return sendJson(res, 400, { error: 'Pedido inválido.' });
    }
    if (!order.statusHistory || !order.statusHistory.length) {
      order.fulfillmentStatus = order.fulfillmentStatus
        || (order.payment?.status === 'pago' ? 'pago' : order.payment?.status === 'cancelado' ? 'cancelado' : 'pendente');
      order.statusHistory = [{ status: order.fulfillmentStatus, date: order.date || new Date().toISOString() }];
    }
    if (typeof order.trackingCode !== 'string') order.trackingCode = '';

    await sql`
      INSERT INTO orders (id, data, channel, status, fulfillment_status, customer_email, is_demo)
      VALUES (
        ${order.id},
        ${JSON.stringify(order)}::jsonb,
        ${order.channel || 'online'},
        ${order.payment?.status || 'pendente'},
        ${order.fulfillmentStatus || 'pendente'},
        ${(order.customer?.email || '').toLowerCase()},
        ${!!order.demo}
      )
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        status = EXCLUDED.status,
        fulfillment_status = EXCLUDED.fulfillment_status,
        updated_at = now()
    `;
    return sendJson(res, 201, { ok: true, order });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
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
