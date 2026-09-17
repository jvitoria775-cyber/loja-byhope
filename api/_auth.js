// PIN do painel administrativo + login de clientes atacadistas +
// emissão/checagem de tokens de sessão.
//
// Segredos (PIN, senha de cliente) nunca são guardados em texto puro -
// ficam como hash PBKDF2-SHA256, no formato
// "pbkdf2$<iteracoes>$<saltHex>$<hashHex>". No primeiro login do admin
// (quando 'admin_pin_hash' ainda não existe), o PIN padrão "2026" é aceito
// e o hash real já é calculado e salvo naquele momento pela própria função
// Node - evita o risco de calcular esse hash "na mão" em outro lugar e ele
// não bater.
//
// Sessão: como funções serverless não guardam estado entre chamadas, a
// "sessão" é um token auto-assinado (HMAC-SHA256), sem biblioteca de JWT -
// só o módulo `crypto` nativo do Node. O token carrega um claim `aud`
// ("admin" ou "customer") para que um token de cliente nunca possa ser
// usado numa rota de admin (ou vice-versa) mesmo que a assinatura seja
// válida - sem isso, os dois sistemas de login "vazariam" um pro outro.
import crypto from 'node:crypto';
import { sql } from './_db.js';

const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha256';
const DEFAULT_PIN = '2026';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const CUSTOMER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias - cliente na própria casa, sentido persistir

function hashSecret(secret, saltBuffer) {
  const salt = saltBuffer || crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEYLEN, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifySecret(secret, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  const actual = crypto.pbkdf2Sync(secret, salt, iterations, expected.length, DIGEST);
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

export { hashSecret, verifySecret };

export async function checkPinAndBootstrap(pin) {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'admin_pin_hash'`;
  if (rows.length === 0) {
    if (pin !== DEFAULT_PIN) return false;
    const stored = hashSecret(pin);
    await sql`
      INSERT INTO settings (key, value) VALUES ('admin_pin_hash', ${JSON.stringify(stored)}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;
    return true;
  }
  return verifySecret(pin, rows[0].value);
}

export async function changePin(currentPin, newPin) {
  const ok = await checkPinAndBootstrap(currentPin);
  if (!ok) return false;
  const stored = hashSecret(newPin);
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

function signToken(payloadObj) {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

// Retorna o payload (já verificado quanto à assinatura e expiração) ou
// null se o token for ausente/inválido/expirado.
function readToken(token) {
  if (!token) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// ---------- Admin ----------

export function issueToken() {
  return signToken({ aud: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL_MS });
}

export function verifyToken(token) {
  const payload = readToken(token);
  return !!payload && payload.aud === 'admin';
}

// Chame no topo de qualquer endpoint que grava dados do painel. Retorna
// false (e já responde 401) quando o token estiver ausente/inválido/
// expirado/for de outro tipo (ex.: token de cliente atacadista).
export function requireAuth(req, res) {
  if (!verifyToken(getBearerToken(req))) {
    res.status(401).json({ error: 'Não autorizado. Faça login novamente no painel.' });
    return false;
  }
  return true;
}

// ---------- Cliente atacadista ----------

export function issueCustomerToken(customerId) {
  return signToken({ aud: 'customer', cid: customerId, exp: Date.now() + CUSTOMER_TOKEN_TTL_MS });
}

// Devolve o id do cliente se o token for válido e for realmente um token
// de cliente (nunca aceita um token de admin aqui), senão null.
export function verifyCustomerToken(token) {
  const payload = readToken(token);
  if (!payload || payload.aud !== 'customer' || !payload.cid) return null;
  return payload.cid;
}

// Mesma ideia de requireAuth, mas para rotas do cliente. Em caso de
// sucesso, devolve o customerId (nunca precisa ser lido de outro lugar).
export function requireCustomerAuth(req, res) {
  const customerId = verifyCustomerToken(getBearerToken(req));
  if (!customerId) {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return null;
  }
  return customerId;
}

// O painel pode desativar o atacado de um cliente específico (rebaixar
// para varejo) sem bloquear a conta dele - ele continua entrando e vendo
// os próprios pedidos, só deixa de desbloquear preço de atacado. Por isso
// essa checagem é sempre feita contra o banco (nunca confiar só no que o
// token diz), senão desativar alguém não faria efeito até o token expirar
// (até 30 dias).
export async function isCustomerWholesaleActive(customerId) {
  if (!customerId) return false;
  const { rows } = await sql`SELECT status FROM wholesale_customers WHERE id = ${customerId}`;
  return rows.length > 0 && rows[0].status === 'active';
}

// Usado por rotas públicas que precisam decidir, sem exigir login
// nenhum, se quem está perguntando tem direito a ver preço de atacado
// (admin do painel OU cliente atacadista autenticado E ativo). Nunca
// lança 401 - só informa o contexto pra quem chamou decidir o que devolver.
export async function getPricingContext(req) {
  const token = getBearerToken(req);
  if (verifyToken(token)) return { isAdmin: true, customerId: null };
  const customerId = verifyCustomerToken(token);
  if (!customerId) return { isAdmin: false, customerId: null };
  const active = await isCustomerWholesaleActive(customerId);
  return { isAdmin: false, customerId: active ? customerId : null };
}
