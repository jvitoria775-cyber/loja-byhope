import { sql, handlePreflight, sendJson } from '../_db.js';
import { requireAuth } from '../_auth.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!requireAuth(req, res)) return;
  if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'Método não permitido.' });

  const id = req.url.split('?')[0].split('/').filter(Boolean).pop();
  await sql`DELETE FROM manual_customers WHERE id = ${id}`;
  return sendJson(res, 200, { ok: true });
}
