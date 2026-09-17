import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth, verifyCustomerToken, isCustomerWholesaleActive } from '../_auth.js';

// GET: lista todos os pedidos (protegido - só o painel administrativo).
// POST: cria um novo pedido (público - usado pelo checkout da loja e pelo
// PDV; qualquer cliente precisa poder registrar o próprio pedido). Se vier
// um token de cliente atacadista válido, o pedido é vinculado a ele
// (customer_id) - usado em "Meus pedidos" na área da conta. O preço de
// cada item já vem congelado do carrinho (não é recalculado aqui), então
// o pedido sempre mostra o valor realmente pago, mesmo que o preço do
// produto mude depois.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

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

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const customerId = verifyCustomerToken(token);
    if (customerId) {
      // customerId sempre é gravado (a conta é dona do pedido, aparece em
      // "Meus pedidos" de qualquer forma), mas customerType só vira
      // "wholesale" se o painel não tiver desativado o atacado dessa
      // conta nesse meio-tempo - o preço já veio certo do carrinho (o
      // servidor nunca manda wholesaleTiers pra quem está desativado), isso
      // aqui é só pra etiqueta do pedido bater com a realidade.
      order.customerId = customerId;
      order.customerType = (await isCustomerWholesaleActive(customerId)) ? 'wholesale' : 'retail';
    }

    await sql`
      INSERT INTO orders (id, data, channel, status, fulfillment_status, customer_email, is_demo, customer_id)
      VALUES (
        ${order.id},
        ${JSON.stringify(order)}::jsonb,
        ${order.channel || 'online'},
        ${order.payment?.status || 'pendente'},
        ${order.fulfillmentStatus || 'pendente'},
        ${(order.customer?.email || '').toLowerCase()},
        ${!!order.demo},
        ${customerId || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        status = EXCLUDED.status,
        fulfillment_status = EXCLUDED.fulfillment_status,
        customer_id = EXCLUDED.customer_id,
        updated_at = now()
    `;
    return sendJson(res, 201, { ok: true, order });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}
