import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';
import { catalogMeta } from '../_catalogMeta.js';

// Cobre /api/products/:id, /api/products/:id/hide e
// /api/products/bulk-stock (a rota base /api/products vive em
// products/index.js - o catch-all aqui só recebe caminhos com 1+ segmentos).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  const segments = [].concat(req.query.path || []);

  if (segments.length === 1 && segments[0] === 'bulk-stock') return handleBulkStock(req, res);
  if (segments.length === 1) return handleSingle(req, res, segments[0]);
  if (segments.length === 2 && segments[1] === 'hide') return handleHide(req, res, segments[0]);
  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}

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

// PUT: atualiza preço/promoção/estoque de um produto oficial (override) ou
// de um produto de demonstração. DELETE: remove um produto de
// demonstração (o catálogo oficial nunca pode ser excluído por aqui - ver
// handleHide). Ambos protegidos.
async function handleSingle(req, res, id) {
  if (!requireAuth(req, res)) return;

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
    await sql`DELETE FROM mock_products WHERE id = ${id}`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

// Oculta um produto oficial da listagem do painel (nunca da loja - o
// catálogo real vive em src/data/products.js e não é alterado por aqui).
async function handleHide(req, res, id) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Método não permitido.' });

  const { rows } = await sql`SELECT value FROM settings WHERE key = 'hidden_products'`;
  const hidden = rows.length ? rows[0].value : [];
  if (!hidden.includes(id)) hidden.push(id);

  await sql`
    INSERT INTO settings (key, value) VALUES ('hidden_products', ${JSON.stringify(hidden)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return sendJson(res, 200, { hiddenProductIds: hidden });
}

// Define o mesmo estoque para TODAS as cores e tamanhos de TODOS os
// produtos (oficiais + demonstração) de uma vez.
async function handleBulkStock(req, res) {
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
