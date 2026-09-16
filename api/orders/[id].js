import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

// GET: busca um pedido específico (público - usado pela página de
// confirmação após o pagamento, o próprio cliente lendo o pedido dele).
// PATCH: atualiza status de separação/envio e código de rastreio
// (protegido - só o painel administrativo).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  const { id } = req.query;

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
