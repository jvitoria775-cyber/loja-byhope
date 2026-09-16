import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { requireAuth } from './_auth.js';

// POST: recebe uma lista de pedidos de demonstração já montados pelo
// navegador (src/admin/mockData.js mantém a lógica de gerar nomes/cidades
// aleatórios - aqui só persistimos) e insere todos de uma vez.
// DELETE: remove todos os pedidos marcados como demonstração (is_demo).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;

  if (req.method === 'POST') {
    const { orders } = readJsonBody(req);
    if (!Array.isArray(orders) || !orders.length) {
      return sendJson(res, 400, { error: 'Nenhum pedido de demonstração informado.' });
    }
    for (const order of orders) {
      await sql`
        INSERT INTO orders (id, data, channel, status, fulfillment_status, customer_email, is_demo)
        VALUES (
          ${order.id}, ${JSON.stringify(order)}::jsonb, ${order.channel || 'online'},
          ${order.payment?.status || 'pendente'}, ${order.fulfillmentStatus || 'pendente'},
          ${(order.customer?.email || '').toLowerCase()}, TRUE
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    return sendJson(res, 201, { ok: true, count: orders.length });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM orders WHERE is_demo = TRUE`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}
