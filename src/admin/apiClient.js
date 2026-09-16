// Cliente HTTP compartilhado pelos módulos de dados do painel/PDV
// (orderStore.js, customerStore.js, productAdminStore.js, settingsStore.js).
// Toda chamada aqui anexa o token de sessão do admin (ver adminAuth.js) -
// os endpoints protegidos em /api exigem esse token; os poucos endpoints
// públicos simplesmente ignoram o header quando presente.
import { getToken } from './adminAuth.js';

const BASE = '/api';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` };
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia */ }
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status} ao comunicar com o servidor.`);
  }
  return data;
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiPatch = (path, body) => request('PATCH', path, body);
export const apiDelete = (path) => request('DELETE', path);
