import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

// Faz merge raso nos campos soltos (price, promoPrice, cost) e merge
// profundo em stockByColorSize (por cor, depois por tamanho) - assim o
// painel pode mandar só a cor que está editando sem apagar o estoque das
// outras cores já salvas.
function mergeOverride(current, patch) {
  const next = { ...current };
  if (patch.price !== undefined) next.price = patch.price;
  if (patch.promoPrice !== undefined) next.promoPrice = patch.promoPrice;
  if (patch.cost !== undefined) next.cost = patch.cost;
  if (patch.stockByColorSize) {
    next.stockByColorSize = { ...(current.stockByColorSize || {}) };
    Object.entries(patch.stockByColorSize).forEach(([colorSlug, bySize]) => {
      next.stockByColorSize[colorSlug] = { ...(next.stockByColorSize[colorSlug] || {}), ...bySize };
    });
  }
  return next;
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  const { id } = req.query;

  if (req.method === 'PUT') {
    const patch = readJsonBody(req);
    const { rows: mockRows } = await sql`SELECT data FROM mock_products WHERE id = ${id}`;

    if (mockRows.length) {
      const merged = mergeOverride(mockRows[0].data, patch);
      const product = { ...mockRows[0].data, ...merged };
      await sql`UPDATE mock_products SET data = ${JSON.stringify(product)}::jsonb WHERE id = ${id}`;
      return sendJson(res, 200, { product });
    }

    const { rows: ovRows } = await sql`SELECT data FROM product_overrides WHERE product_id = ${id}`;
    const merged = mergeOverride(ovRows.length ? ovRows[0].data : {}, patch);
    await sql`
      INSERT INTO product_overrides (product_id, data) VALUES (${id}, ${JSON.stringify(merged)}::jsonb)
      ON CONFLICT (product_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;
    return sendJson(res, 200, { override: merged });
  }

  if (req.method === 'DELETE') {
    // Só remove produtos de demonstração - o catálogo oficial nunca pode
    // ser excluído por aqui (ver /api/products/[id]/hide.js para ocultar).
    await sql`DELETE FROM mock_products WHERE id = ${id}`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}
