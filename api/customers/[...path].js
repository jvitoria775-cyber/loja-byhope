import { sql, handlePreflight, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

// Cobre /api/customers/:id (a rota base /api/customers vive em
// customers/index.js - o catch-all aqui só recebe caminhos com 1+
// segmentos).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  const segments = [].concat(req.query.path || []);

  if (segments.length === 1) {
    if (req.method === 'DELETE') {
      await sql`DELETE FROM manual_customers WHERE id = ${segments[0]}`;
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }

  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}
