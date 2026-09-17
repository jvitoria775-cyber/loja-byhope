// Contas reais de clientes atacadistas (cadastro/login em api/account.js),
// vistas e editadas pelo painel. Diferente de customerStore.js (que é um
// CRM derivado de pedidos + contatos manuais) - aqui é a conta de verdade
// que o próprio cliente usa para entrar no site.
import { apiPost } from './apiClient.js';

let _cache = null;
let _promise = null;

async function load() {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = apiPost('/account', { action: 'admin-list' })
      .then((data) => { _cache = data.customers; return _cache; })
      .catch((err) => { _promise = null; throw err; });
  }
  return _promise;
}

export function invalidateWholesaleCustomersCache() {
  _cache = null;
  _promise = null;
}

export async function getWholesaleCustomers() {
  return load();
}

export async function updateWholesaleCustomer(id, fields) {
  const { customer } = await apiPost('/account', { action: 'admin-update', id, ...fields });
  invalidateWholesaleCustomersCache();
  return customer;
}

export async function setWholesaleCustomerStatus(id, status) {
  const { customer } = await apiPost('/account', { action: 'admin-set-status', id, status });
  invalidateWholesaleCustomersCache();
  return customer;
}
