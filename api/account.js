import crypto from 'node:crypto';
import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { hashSecret, verifySecret, issueCustomerToken, requireCustomerAuth, requireAuth } from './_auth.js';
import { isValidEmail, isValidDoc, onlyDigits } from './_validators.js';
import { sendEmail } from './_email.js';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

// Tudo o que o cliente atacadista precisa para se cadastrar/entrar/gerenciar
// a própria conta vive num arquivo só (orçamento de funções serverless do
// plano gratuito da Vercel é apertado - ver comentário em api/orders/[id].js
// sobre o padrão "action no corpo").
//
// POST { action: 'register' | 'login' | 'forgot-password' | 'reset-password', ... } - público
// POST { action: 'admin-list' | 'admin-update' | 'admin-set-status', ... } - painel (PIN)
// GET  (Authorization: Bearer <token-do-cliente>) - devolve {customer, orders}
// PUT  { action: 'update-profile' | 'change-password', ... } - autenticado
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method === 'POST') {
    const body = readJsonBody(req);
    if (body.action === 'register') return handleRegister(res, body);
    if (body.action === 'login') return handleLogin(res, body);
    if (body.action === 'forgot-password') return handleForgotPassword(req, res, body);
    if (body.action === 'reset-password') return handleResetPassword(res, body);
    if (body.action === 'admin-list') { if (!requireAuth(req, res)) return; return handleAdminList(res); }
    if (body.action === 'admin-update') { if (!requireAuth(req, res)) return; return handleAdminUpdate(res, body); }
    if (body.action === 'admin-set-status') { if (!requireAuth(req, res)) return; return handleAdminSetStatus(res, body); }
    return sendJson(res, 400, { error: 'Ação inválida.' });
  }

  if (req.method === 'GET') {
    const customerId = requireCustomerAuth(req, res);
    if (!customerId) return;
    return handleGetAccount(res, customerId);
  }

  if (req.method === 'PUT') {
    const customerId = requireCustomerAuth(req, res);
    if (!customerId) return;
    const body = readJsonBody(req);
    if (body.action === 'change-password') return handleChangePassword(res, customerId, body);
    return handleUpdateProfile(res, customerId, body);
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

function toPublicCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    docType: row.doc_type,
    docNumber: row.doc_number,
    status: row.status,
    createdAt: row.created_at,
    ...row.data,
  };
}

async function handleRegister(res, body) {
  const { docType, docNumber, fullName, storeName, phone, email, password, address } = body;

  if (!fullName || !String(fullName).trim()) return sendJson(res, 400, { error: 'Informe o nome completo / razão social.' });
  if (!email || !isValidEmail(email)) return sendJson(res, 400, { error: 'Informe um e-mail válido.' });
  if (!password || String(password).length < 6) return sendJson(res, 400, { error: 'A senha precisa ter pelo menos 6 caracteres.' });
  if (docType !== 'cpf' && docType !== 'cnpj') return sendJson(res, 400, { error: 'Selecione se o cadastro é Pessoa Física ou Jurídica.' });
  if (!isValidDoc(docType, docNumber)) {
    return sendJson(res, 400, { error: docType === 'cpf' ? 'CPF inválido.' : 'CNPJ inválido.' });
  }

  const cleanDoc = onlyDigits(docNumber);
  const cleanEmail = String(email).trim().toLowerCase();

  const [{ rows: emailRows }, { rows: docRows }] = await Promise.all([
    sql`SELECT id FROM wholesale_customers WHERE email = ${cleanEmail}`,
    sql`SELECT id FROM wholesale_customers WHERE doc_number = ${cleanDoc}`,
  ]);
  if (emailRows.length) return sendJson(res, 409, { error: 'Já existe uma conta cadastrada com este e-mail.' });
  if (docRows.length) return sendJson(res, 409, { error: `Já existe uma conta cadastrada com este ${docType === 'cpf' ? 'CPF' : 'CNPJ'}.` });

  const id = `atc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = hashSecret(password);
  const data = {
    fullName: String(fullName).trim(),
    storeName: storeName ? String(storeName).trim() : '',
    phone: phone ? String(phone).trim() : '',
    address: address || {},
  };

  await sql`
    INSERT INTO wholesale_customers (id, email, password_hash, doc_type, doc_number, data)
    VALUES (${id}, ${cleanEmail}, ${passwordHash}, ${docType}, ${cleanDoc}, ${JSON.stringify(data)}::jsonb)
  `;

  const token = issueCustomerToken(id);
  return sendJson(res, 201, { token, customer: { id, email: cleanEmail, docType, docNumber: cleanDoc, ...data } });
}

async function handleLogin(res, body) {
  const { email, password } = body;
  if (!email || !password) return sendJson(res, 400, { error: 'Informe e-mail e senha.' });

  const cleanEmail = String(email).trim().toLowerCase();
  const { rows } = await sql`SELECT * FROM wholesale_customers WHERE email = ${cleanEmail}`;
  if (!rows.length || !verifySecret(password, rows[0].password_hash)) {
    return sendJson(res, 401, { error: 'E-mail ou senha incorretos.' });
  }

  const token = issueCustomerToken(rows[0].id);
  return sendJson(res, 200, { token, customer: toPublicCustomer(rows[0]) });
}

async function handleForgotPassword(req, res, body) {
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  if (!cleanEmail) return sendJson(res, 400, { error: 'Informe o e-mail cadastrado.' });

  const { rows } = await sql`SELECT id, data FROM wholesale_customers WHERE email = ${cleanEmail}`;
  // Sempre devolve sucesso genérico, exista o e-mail ou não - evita que
  // alguém descubra quais e-mails têm conta testando este endpoint.
  if (rows.length) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    await sql`INSERT INTO password_resets (token, customer_id, expires_at) VALUES (${token}, ${rows[0].id}, ${expiresAt})`;

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const link = `${proto}://${host}/#/redefinir-senha?token=${token}`;
    const firstName = (rows[0].data?.fullName || '').split(' ')[0] || 'cliente';

    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'Redefinir senha — Gratitude Têxtil',
        html: `
          <p>Olá, ${firstName}!</p>
          <p>Recebemos um pedido para redefinir a senha da sua conta atacadista na Gratitude Têxtil.</p>
          <p><a href="${link}">Clique aqui para criar uma nova senha</a></p>
          <p>Esse link expira em 1 hora. Se você não pediu essa redefinição, pode ignorar este e-mail.</p>
        `,
      });
    } catch (err) {
      console.error('Falha ao enviar e-mail de redefinição:', err.message);
    }
  }

  return sendJson(res, 200, { ok: true, message: 'Se este e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.' });
}

async function handleResetPassword(res, body) {
  const { token, newPassword } = body;
  if (!token || !newPassword || String(newPassword).length < 6) {
    return sendJson(res, 400, { error: 'Link inválido ou senha muito curta (mínimo 6 caracteres).' });
  }

  const { rows } = await sql`SELECT * FROM password_resets WHERE token = ${token}`;
  const reset = rows[0];
  if (!reset || reset.used || new Date(reset.expires_at).getTime() < Date.now()) {
    return sendJson(res, 400, { error: 'Este link de redefinição é inválido ou expirou. Solicite um novo.' });
  }

  const passwordHash = hashSecret(newPassword);
  await sql`UPDATE wholesale_customers SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${reset.customer_id}`;
  await sql`UPDATE password_resets SET used = TRUE WHERE token = ${token}`;

  return sendJson(res, 200, { ok: true });
}

async function handleGetAccount(res, customerId) {
  const { rows } = await sql`SELECT * FROM wholesale_customers WHERE id = ${customerId}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Conta não encontrada.' });

  const { rows: orderRows } = await sql`SELECT data FROM orders WHERE customer_id = ${customerId} ORDER BY created_at DESC`;
  return sendJson(res, 200, { customer: toPublicCustomer(rows[0]), orders: orderRows.map((r) => r.data) });
}

async function handleUpdateProfile(res, customerId, body) {
  const { rows } = await sql`SELECT data FROM wholesale_customers WHERE id = ${customerId}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Conta não encontrada.' });

  const current = rows[0].data || {};
  const next = {
    ...current,
    fullName: body.fullName !== undefined ? String(body.fullName).trim() : current.fullName,
    storeName: body.storeName !== undefined ? String(body.storeName).trim() : current.storeName,
    phone: body.phone !== undefined ? String(body.phone).trim() : current.phone,
    address: body.address !== undefined ? { ...(current.address || {}), ...body.address } : current.address,
  };

  await sql`UPDATE wholesale_customers SET data = ${JSON.stringify(next)}::jsonb, updated_at = now() WHERE id = ${customerId}`;
  const { rows: freshRows } = await sql`SELECT * FROM wholesale_customers WHERE id = ${customerId}`;
  return sendJson(res, 200, { customer: toPublicCustomer(freshRows[0]) });
}

async function handleChangePassword(res, customerId, body) {
  const { currentPassword, newPassword } = body;
  if (!newPassword || String(newPassword).length < 6) {
    return sendJson(res, 400, { error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  }

  const { rows } = await sql`SELECT password_hash FROM wholesale_customers WHERE id = ${customerId}`;
  if (!rows.length || !verifySecret(currentPassword || '', rows[0].password_hash)) {
    return sendJson(res, 401, { error: 'Senha atual incorreta.' });
  }

  const passwordHash = hashSecret(newPassword);
  await sql`UPDATE wholesale_customers SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${customerId}`;
  return sendJson(res, 200, { ok: true });
}

// Lista todos os clientes atacadistas para o painel, já com quantidade de
// pedidos e total gasto (mesma ideia da tela de Clientes/CRM, mas aqui é a
// conta real de login, não só um contato derivado de pedidos).
async function handleAdminList(res) {
  const { rows } = await sql`
    SELECT wc.*, COALESCE(stats.order_count, 0)::int AS order_count, COALESCE(stats.total_spent, 0)::numeric AS total_spent
    FROM wholesale_customers wc
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS order_count, SUM((data->>'total')::numeric) AS total_spent
      FROM orders
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id
    ) stats ON stats.customer_id = wc.id
    ORDER BY wc.created_at DESC
  `;
  const customers = rows.map((row) => ({
    ...toPublicCustomer(row),
    ordersCount: row.order_count,
    totalSpent: Number(row.total_spent) || 0,
  }));
  return sendJson(res, 200, { customers });
}

// Edição administrativa dos dados de cadastro. Revalida tudo de novo no
// servidor (mesma regra do cadastro) - nunca confia que o painel já
// validou certo no navegador.
async function handleAdminUpdate(res, body) {
  const { id, docType, docNumber, fullName, storeName, phone, email, address } = body;
  if (!id) return sendJson(res, 400, { error: 'Cliente não informado.' });

  const { rows } = await sql`SELECT * FROM wholesale_customers WHERE id = ${id}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Cliente não encontrado.' });
  const current = rows[0];

  if (!fullName || !String(fullName).trim()) return sendJson(res, 400, { error: 'Informe o nome completo / razão social.' });
  if (email !== undefined && !isValidEmail(email)) return sendJson(res, 400, { error: 'Informe um e-mail válido.' });

  const nextDocType = docType || current.doc_type;
  const nextDocNumber = docNumber !== undefined ? onlyDigits(docNumber) : current.doc_number;
  if (docNumber !== undefined && !isValidDoc(nextDocType, nextDocNumber)) {
    return sendJson(res, 400, { error: nextDocType === 'cpf' ? 'CPF inválido.' : 'CNPJ inválido.' });
  }
  const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : current.email;

  if (nextEmail !== current.email || nextDocNumber !== current.doc_number) {
    const { rows: dupRows } = await sql`
      SELECT id FROM wholesale_customers WHERE id <> ${id} AND (email = ${nextEmail} OR doc_number = ${nextDocNumber})
    `;
    if (dupRows.length) return sendJson(res, 409, { error: 'Já existe outra conta com este e-mail ou documento.' });
  }

  const nextData = {
    ...current.data,
    fullName: String(fullName).trim(),
    storeName: storeName !== undefined ? String(storeName).trim() : current.data.storeName,
    phone: phone !== undefined ? String(phone).trim() : current.data.phone,
    address: address !== undefined ? { ...(current.data.address || {}), ...address } : current.data.address,
  };

  await sql`
    UPDATE wholesale_customers SET
      email = ${nextEmail}, doc_type = ${nextDocType}, doc_number = ${nextDocNumber},
      data = ${JSON.stringify(nextData)}::jsonb, updated_at = now()
    WHERE id = ${id}
  `;
  const { rows: freshRows } = await sql`SELECT * FROM wholesale_customers WHERE id = ${id}`;
  return sendJson(res, 200, { customer: toPublicCustomer(freshRows[0]) });
}

// Ativa/desativa o atacado de um cliente específico - a conta continua
// funcionando normalmente (login, "Minha Conta", pedidos), só deixa de
// desbloquear preço de atacado enquanto estiver 'inactive'. É verificado
// direto no banco a cada requisição (ver isCustomerWholesaleActive em
// _auth.js), então o efeito é imediato, sem depender do token expirar.
async function handleAdminSetStatus(res, body) {
  const { id, status } = body;
  if (status !== 'active' && status !== 'inactive') {
    return sendJson(res, 400, { error: 'Status inválido.' });
  }
  const { rows } = await sql`
    UPDATE wholesale_customers SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING *
  `;
  if (!rows.length) return sendJson(res, 404, { error: 'Cliente não encontrado.' });
  return sendJson(res, 200, { customer: toPublicCustomer(rows[0]) });
}
