import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { requireAuth } from './_auth.js';

const DEFAULT_STORE_INFO = { name: '', cnpj: '', email: '', phone: '', cep: '', street: '', number: '', city: '', state: '' };
const DEFAULT_DISCOUNT = 27;

// GET: dados da loja, desconto geral e lista de produtos ocultos do painel.
// PÚBLICO de propósito - o desconto geral é usado pela loja/PDV para
// qualquer visitante calcular o preço exibido. Nunca devolve o hash do PIN.
// PUT: atualiza dados da loja e/ou o desconto geral (protegido). Também
// cobre a semeadura/limpeza de pedidos de demonstração via
// { action: 'seed-demo' | 'clear-demo' } - antes era api/demo.js, fundido
// aqui pra caber no limite de funções serverless do plano gratuito.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT key, value FROM settings WHERE key IN ('store_info', 'store_discount_percent', 'hidden_products')`;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return sendJson(res, 200, {
      storeInfo: map.store_info || DEFAULT_STORE_INFO,
      discountPercent: map.store_discount_percent ?? DEFAULT_DISCOUNT,
      hiddenProductIds: map.hidden_products || [],
    });
  }

  if (req.method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const body = readJsonBody(req);

    if (body.action === 'seed-demo') return handleSeedDemo(res, body);
    if (body.action === 'clear-demo') return handleClearDemo(res);

    const { storeInfo, discountPercent } = body;
    if (storeInfo) {
      await sql`
        INSERT INTO settings (key, value) VALUES ('store_info', ${JSON.stringify(storeInfo)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
    if (discountPercent !== undefined) {
      const value = Number(discountPercent) > 0 && Number(discountPercent) < 100 ? Number(discountPercent) : 0;
      await sql`
        INSERT INTO settings (key, value) VALUES ('store_discount_percent', ${JSON.stringify(value)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

async function handleSeedDemo(res, body) {
  const { orders } = body;
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

async function handleClearDemo(res) {
  await sql`DELETE FROM orders WHERE is_demo = TRUE`;
  return sendJson(res, 200, { ok: true });
}
