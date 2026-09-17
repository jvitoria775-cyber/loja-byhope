import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth, getPricingContext } from '../_auth.js';

// GET: devolve os ajustes de estoque/preço/promoção (product_overrides) e
// os produtos de demonstração (mock_products). PÚBLICO de propósito - a
// loja, o PDV e o painel leem daqui para saber o preço/estoque atual de
// cada produto; nada aqui é dado sensível.
//
// wholesaleTiers (preço de atacado) é a ÚNICA parte que NÃO é pública: só
// entra na resposta se quem pediu for o painel administrativo OU um
// cliente atacadista autenticado (getPricingContext checa os dois tipos de
// token sem exigir nenhum). Sem token válido, o campo simplesmente não
// existe na resposta - não é só escondido no front, o servidor nunca
// manda esse dado pra quem não tem direito.
// POST: cria um produto de demonstração (protegido).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method === 'GET') {
    const [overridesResult, mockResult] = await Promise.all([
      sql`SELECT product_id, data FROM product_overrides`,
      sql`SELECT data FROM mock_products ORDER BY created_at ASC`,
    ]);
    const { isAdmin, customerId } = getPricingContext(req);
    const canSeeWholesale = isAdmin || !!customerId;

    const overrides = {};
    overridesResult.rows.forEach((row) => {
      overrides[row.product_id] = canSeeWholesale ? row.data : stripWholesale(row.data);
    });

    const mockProducts = mockResult.rows.map((r) => (canSeeWholesale ? r.data : stripWholesale(r.data)));
    return sendJson(res, 200, { overrides, mockProducts });
  }

  if (req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    const data = readJsonBody(req);
    if (!data.name) return sendJson(res, 400, { error: 'Informe o nome do produto.' });

    const { rows: countRows } = await sql`SELECT COUNT(*)::int AS n FROM mock_products`;
    const id = `mock-${Date.now()}`;
    const sizes = ['P', 'M', 'G', 'GG'];
    const perSize = Number(data.stock) || 0;
    const colorSlug = 'padrao';
    const stockByColorSize = { [colorSlug]: {} };
    sizes.forEach((s) => { stockByColorSize[colorSlug][s] = perSize; });

    const product = {
      id,
      sku: `GT-DEMO-${countRows[0].n + 1}`,
      name: data.name,
      category: data.category,
      categoryLabel: data.categoryLabel,
      image: data.image || '',
      cost: Number(data.cost) || 0,
      price: Number(data.price) || 0,
      promoPrice: null,
      sizes,
      stockByColorSize,
      colors: [{ name: 'Padrão', slug: colorSlug, hex: '#C9962E' }],
      colorImages: data.image ? { [colorSlug]: [data.image] } : {},
    };
    await sql`INSERT INTO mock_products (id, data) VALUES (${id}, ${JSON.stringify(product)}::jsonb)`;
    return sendJson(res, 201, { product });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

function stripWholesale(data) {
  if (!data || !data.wholesaleTiers) return data;
  const { wholesaleTiers, ...rest } = data;
  return rest;
}
