import { sql, handlePreflight, readJsonBody, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

// Rota "catch-all" cobrindo /api/customers e /api/customers/:id num único
// arquivo - o plano gratuito da Vercel permite no máximo 12 Serverless
// Functions por deploy, então agrupamos rotas relacionadas em vez de um
// arquivo por endpoint.
//
// Contatos cadastrados manualmente pela equipe (protegido - são dados de
// clientes, só o painel deve ver/editar). A lista "cheia" de clientes,
// agregando pedidos por e-mail, continua sendo calculada no navegador
// (src/admin/customerStore.js) a partir de GET /api/orders + esta lista.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  const segments = [].concat(req.query.path || []);

  if (segments.length === 0) {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT data FROM manual_customers ORDER BY created_at DESC`;
      return sendJson(res, 200, { customers: rows.map((r) => r.data) });
    }
    if (req.method === 'POST') {
      const data = readJsonBody(req);
      if (!data.firstName) return sendJson(res, 400, { error: 'Informe ao menos o nome.' });
      const customer = {
        id: `manual-${Date.now()}`,
        firstName: data.firstName,
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        city: data.city || '',
        state: data.state || '',
        createdAt: new Date().toISOString(),
        manual: true,
      };
      await sql`INSERT INTO manual_customers (id, data) VALUES (${customer.id}, ${JSON.stringify(customer)}::jsonb)`;
      return sendJson(res, 201, { customer });
    }
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }

  if (segments.length === 1) {
    if (req.method === 'DELETE') {
      await sql`DELETE FROM manual_customers WHERE id = ${segments[0]}`;
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }

  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}
