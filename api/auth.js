import { handlePreflight, readJsonBody, sendJson } from './_db.js';
import { checkPinAndBootstrap, changePin, issueToken, requireAuth } from './_auth.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method === 'POST') {
    const { pin } = readJsonBody(req);
    if (!pin) return sendJson(res, 400, { error: 'Informe o PIN.' });
    const ok = await checkPinAndBootstrap(String(pin));
    if (!ok) return sendJson(res, 401, { error: 'PIN incorreto.' });
    return sendJson(res, 200, { token: issueToken() });
  }

  if (req.method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const { currentPin, newPin } = readJsonBody(req);
    if (!currentPin || !newPin || String(newPin).length < 4) {
      return sendJson(res, 400, { error: 'Informe o PIN atual e um novo PIN com pelo menos 4 dígitos.' });
    }
    const ok = await changePin(String(currentPin), String(newPin));
    if (!ok) return sendJson(res, 401, { error: 'PIN atual incorreto.' });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}
