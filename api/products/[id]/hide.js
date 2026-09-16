import { sql, handlePreflight, sendJson } from '../../_db.js';
import { requireAuth } from '../../_auth.js';

// Oculta um produto oficial da listagem do painel (nunca da loja - o
// catálogo real vive em src/data/products.js e não é alterado por aqui).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Método não permitido.' });

  const { id } = req.query;
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'hidden_products'`;
  const hidden = rows.length ? rows[0].value : [];
  if (!hidden.includes(id)) hidden.push(id);

  await sql`
    INSERT INTO settings (key, value) VALUES ('hidden_products', ${JSON.stringify(hidden)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return sendJson(res, 200, { hiddenProductIds: hidden });
}
