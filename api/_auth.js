// PIN do painel administrativo + emissão/checagem de token de sessão.
//
// O PIN nunca é guardado em texto puro - fica como hash PBKDF2-SHA256 na
// tabela settings (chave 'admin_pin_hash'), no formato
// "pbkdf2$<iteracoes>$<saltHex>$<hashHex>". No primeiro login (quando essa
// chave ainda não existe), o PIN padrão "2026" é aceito e o hash real já é
// calculado e salvo naquele momento pela própria função Node - evita o
// risco de calcular esse hash "na mão" em outro lugar e ele não bater.
//
// Sessão: como funções serverless não guardam estado entre chamadas, a
// "sessão" é um token auto-assinado (HMAC-SHA256 com ADMIN_TOKEN_SECRET),
// sem biblioteca de JWT - só o módulo `crypto` nativo do Node. Todo
// endpoint que grava dados exige esse token no header
// `Authorization: Bearer <token>`.
import crypto from 'node:crypto';
import { sql } from './_db.js';

const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha256';
const DEFAULT_PIN = '2026';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function hashPin(pin, saltBuffer) {
  const salt = saltBuffer || crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(pin, salt, ITERATIONS, KEYLEN, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPin(pin, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  const actual = crypto.pbkdf2Sync(pin, salt, iterations, expected.length, DIGEST);
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

export async function checkPinAndBootstrap(pin) {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'admin_pin_hash'`;
  if (rows.length === 0) {
    if (pin !== DEFAULT_PIN) return false;
    const stored = hashPin(pin);
    await sql`
      INSERT INTO settings (key, value) VALUES ('admin_pin_hash', ${JSON.stringify(stored)}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;
    return true;
  }
  return verifyPin(pin, rows[0].value);
}

export async function changePin(currentPin, newPin) {
  const ok = await checkPinAndBootstrap(currentPin);
  if (!ok) return false;
  const stored = hashPin(newPin);
  await sql`
    INSERT INTO settings (key, value) VALUES ('admin_pin_hash', ${JSON.stringify(stored)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return true;
}

function getSecret() {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) throw new Error('ADMIN_TOKEN_SECRET não configurado nas variáveis de ambiente da Vercel.');
  return secret;
}

export function issueToken() {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Chame no topo de qualquer endpoint que grava dados. Retorna false (e já
// responde 401) quando o token estiver ausente/inválido/expirado.
export function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Não autorizado. Faça login novamente no painel.' });
    return false;
  }
  return true;
}
