// Cliente real da conta de atacadista (api/account.js) - antes era um
// cadastro/login mockado (senha em texto puro no localStorage). Mantém os
// nomes já usados por login.js/register.js/header.js/checkout.js
// (getCurrentUser, login, register, logout) para não precisar reescrever
// tudo o que já existia.
//
// Token + dados do cliente ficam em localStorage (não sessionStorage): é o
// próprio cliente atacadista acessando de casa/da loja, faz sentido a
// sessão persistir entre visitas - diferente do admin, que usa
// sessionStorage no painel.
import { getItem, setItem, removeItem } from '../utils/storage.js';
import { invalidateCatalogCache } from '../services/catalogService.js';

const SESSION_KEY = 'wholesale_session'; // { token, customer }

// Pedido mínimo do atacado (em peças, somando todos os itens do
// carrinho) - decisão do negócio, aplicada só no checkout self-service da
// loja online (o PDV, com atendente, não tem essa trava).
export const WHOLESALE_MIN_QTY = 5;

export function getCurrentUser() {
  const session = getItem(SESSION_KEY, null);
  return session?.customer || null;
}

export function getToken() {
  const session = getItem(SESSION_KEY, null);
  return session?.token || null;
}

export function isWholesale() {
  return !!getCurrentUser();
}

function setSession(token, customer) {
  setItem(SESSION_KEY, { token, customer });
}

function emit() {
  window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: getCurrentUser() } }));
}

async function postAccount(body) {
  const res = await fetch('/api/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function register(fields) {
  const { ok, data } = await postAccount({ action: 'register', ...fields });
  if (!ok) return { ok: false, message: data.error || 'Não foi possível concluir o cadastro.' };
  setSession(data.token, data.customer);
  invalidateCatalogCache();
  emit();
  return { ok: true, user: data.customer };
}

export async function login({ email, password }) {
  const { ok, data } = await postAccount({ action: 'login', email, password });
  if (!ok) return { ok: false, message: data.error || 'E-mail ou senha incorretos.' };
  setSession(data.token, data.customer);
  invalidateCatalogCache();
  emit();
  return { ok: true, user: data.customer };
}

export function logout() {
  removeItem(SESSION_KEY);
  invalidateCatalogCache();
  emit();
}

export async function requestPasswordReset(email) {
  const { data } = await postAccount({ action: 'forgot-password', email });
  return { ok: true, message: data.message || 'Se este e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.' };
}

export async function resetPassword(token, newPassword) {
  const { ok, data } = await postAccount({ action: 'reset-password', token, newPassword });
  if (!ok) return { ok: false, message: data.error || 'Não foi possível redefinir a senha. Solicite um novo link.' };
  return { ok: true };
}

export async function fetchMyAccount() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    logout();
    return null;
  }
  if (!res.ok) throw new Error('Não foi possível carregar sua conta.');
  const data = await res.json();
  setSession(token, data.customer);
  return data;
}

export async function updateProfile(fields) {
  const token = getToken();
  if (!token) return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
  const res = await fetch('/api/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data.error || 'Não foi possível salvar seus dados.' };
  setSession(token, data.customer);
  emit();
  return { ok: true, user: data.customer };
}

export async function changePassword({ currentPassword, newPassword }) {
  const token = getToken();
  if (!token) return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
  const res = await fetch('/api/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data.error || 'Não foi possível trocar a senha.' };
  return { ok: true };
}
