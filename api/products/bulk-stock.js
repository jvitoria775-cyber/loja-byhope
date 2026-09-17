import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';
import { catalogMeta } from '../_catalogMeta.js';

// Define o mesmo estoque para TODAS as cores e tamanhos de TODOS os
// produtos (oficiais + demonstração) de uma vez.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const { qty } = readJsonBody(req);
  const value = Math.max(0, Number(qty) || 0);

  const { rows: overrideRows } = await sql`SELECT product_id, data FROM product_overrides`;
  const overridesById = new Map(overrideRows.map((r) => [r.product_id, r.data]));

  for (const p of catalogMeta) {
    const current = overridesById.get(p.id) || {};
    const stockByColorSize = { ...(current.stockByColorSize || {}) };
    p.colors.forEach((colorSlug) => {
      const bySize = { ...(stockByColorSize[colorSlug] || {}) };
      p.sizes.forEach((s) => { bySize[s] = value; });
      stockByColorSize[colorSlug] = bySize;
    });
    const next = { ...current, stockByColorSize };
    await sql`
      INSERT INTO product_overrides (product_id, data) VALUES (${p.id}, ${JSON.stringify(next)}::jsonb)
      ON CONFLICT (product_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;
  }

  const { rows: mockRows } = await sql`SELECT id, data FROM mock_products`;
  for (const row of mockRows) {
    const product = row.data;
    const stockByColorSize = { ...(product.stockByColorSize || {}) };
    (product.colors || []).forEach((c) => {
      const bySize = { ...(stockByColorSize[c.slug] || {}) };
      (product.sizes || []).forEach((s) => { bySize[s] = value; });
      stockByColorSize[c.slug] = bySize;
    });
    const next = { ...product, stockByColorSize };
    await sql`UPDATE mock_products SET data = ${JSON.stringify(next)}::jsonb WHERE id = ${row.id}`;
  }

  return sendJson(res, 200, { ok: true, qty: value });
}
