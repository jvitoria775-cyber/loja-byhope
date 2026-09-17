import { sql, handlePreflight, readJsonBody, sendJson, getIdFromUrl } from '../_db.js';
import { requireAuth } from '../_auth.js';

// PUT com { action: "hide" } no corpo: oculta um produto oficial da
// listagem do painel (nunca da loja - o catálogo real vive em
// src/data/products.js).
// PUT sem essa ação: atualiza preço/promoção/estoque de um produto oficial
// (override) ou de um produto de demonstração.
// DELETE: remove um produto de demonstração (o catálogo oficial nunca pode
// ser excluído por aqui). Tudo protegido.
//
// A "ação" vai no corpo, não na query string - ver comentário em
// api/orders/[id].js sobre por que a query string não é confiável aqui.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  const id = getIdFromUrl(req);

  if (req.method === 'PUT') {
    const body = readJsonBody(req);
    if (body.action === 'hide') return handleHide(res, id);
    return handleUpdate(res, id, body);
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM mock_products WHERE id = ${id}`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
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

async function handleUpdate(res, id, patch) {
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

async function handleHide(res, id) {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'hidden_products'`;
  const hidden = rows.length ? rows[0].value : [];
  if (!hidden.includes(id)) hidden.push(id);

  await sql`
    INSERT INTO settings (key, value) VALUES ('hidden_products', ${JSON.stringify(hidden)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return sendJson(res, 200, { hiddenProductIds: hidden });
}
