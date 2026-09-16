// Dados da loja, desconto geral e lista de produtos ocultos - tudo o que
// antes era lido/gravado direto em localStorage por src/admin/pages/
// settings.js agora vem de /api/settings (banco compartilhado).
import { apiGet, apiPut } from './apiClient.js';

const DEFAULT_STORE_INFO = { name: '', cnpj: '', email: '', phone: '', cep: '', street: '', number: '', city: '', state: '' };

let _cache = null;
let _promise = null;

async function load() {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = apiGet('/settings')
      .then((data) => { _cache = data; return _cache; })
      .catch((err) => { _promise = null; throw err; });
  }
  return _promise;
}

export function invalidateSettingsCache() {
  _cache = null;
  _promise = null;
}

export async function getStoreSettings() {
  const { storeInfo } = await load();
  return storeInfo || DEFAULT_STORE_INFO;
}

export async function saveStoreSettings(storeInfo) {
  await apiPut('/settings', { storeInfo });
  invalidateSettingsCache();
}

export async function getStoreDiscountPercent() {
  const { discountPercent } = await load();
  return discountPercent || 0;
}

export async function setStoreDiscountPercent(percent) {
  await apiPut('/settings', { discountPercent: percent });
  invalidateSettingsCache();
}

export async function getHiddenProductIds() {
  const { hiddenProductIds } = await load();
  return hiddenProductIds || [];
}
