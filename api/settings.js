import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { requireAuth } from './_auth.js';

const DEFAULT_STORE_INFO = { name: '', cnpj: '', email: '', phone: '', cep: '', street: '', number: '', city: '', state: '' };
const DEFAULT_DISCOUNT = 27;

// GET: dados da loja, desconto geral e lista de produtos ocultos do painel.
// PÚBLICO de propósito - o desconto geral é usado pela loja/PDV para
// qualquer visitante calcular o preço exibido. Nunca devolve o hash do PIN.
// PUT: atualiza dados da loja e/ou o desconto geral (protegido).
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
    const { storeInfo, discountPercent } = readJsonBody(req);

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
