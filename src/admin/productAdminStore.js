// Camada administrativa de produtos. NUNCA escreve em src/data/products.js
// (a fonte real do catálogo da loja) - em vez disso guarda ajustes (estoque,
// preço, preço promocional) e produtos de demonstração no banco
// compartilhado (via /api/products), e devolve a lista já "mesclada" para
// exibição no painel. src/services/catalogService.js lê a mesma fonte para
// a loja e o PDV - uma alteração feita aqui aparece em qualquer aparelho.
import { products as realProducts } from '../data/products.js';
import { getCatalogProducts } from '../services/catalogService.js';
import { getHiddenProductIds, invalidateSettingsCache } from './settingsStore.js';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

// Custos reais por categoria, conforme o arquivo CUSTO.txt oficial da
// empresa (ver README - "Origem dos dados"): custo do produto + custo fixo
// de envio/embalagem (R$ 3,10 por peça).
export const PRODUCT_COSTS = {
  camiseta: 13.10,
  babylook: 11.70,
  cropped: 12.60,
  regata: 12.60,
  moletom: 33.10,
  short: 13.30,
};

let _cache = null; // { overrides, mockProducts }
let _promise = null;

async function loadProductsData() {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = apiGet('/products')
      .then((data) => { _cache = data; return _cache; })
      .catch((err) => { _promise = null; throw err; });
  }
  return _promise;
}

export function invalidateProductsCache() {
  _cache = null;
  _promise = null;
}

function skuFor(product) {
  const catCode = (product.category || 'GEN').slice(0, 3).toUpperCase();
  const num = product.id.replace(/\D/g, '').padStart(3, '0').slice(-3);
  return `GT-${catCode}-${num}`;
}

function totalStock(stockBySize) {
  return Object.values(stockBySize || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

// Recalcula o estoque agregado por tamanho (soma de todas as cores) a
// partir do estoque por cor+tamanho — usado nos produtos de demonstração,
// que não passam pela mescla de src/services/catalogService.js.
function aggregateStockBySize(sizes, stockByColorSize) {
  const out = {};
  (sizes || []).forEach((s) => {
    out[s] = Object.values(stockByColorSize || {}).reduce((sum, bySize) => sum + (Number(bySize[s]) || 0), 0);
  });
  return out;
}

const LOW_STOCK_THRESHOLD = 10;

export async function getAdminProducts() {
  const [{ overrides, mockProducts }, hidden, merged] = await Promise.all([
    loadProductsData(),
    getHiddenProductIds(),
    getCatalogProducts(),
  ]);
  const hiddenSet = new Set(hidden);
  const mergedById = new Map(merged.map((p) => [p.id, p]));

  const fromCatalog = realProducts
    .filter((p) => !hiddenSet.has(p.id))
    .map((p) => {
      const ov = overrides[p.id] || {};
      const m = mergedById.get(p.id);
      const price = ov.price ?? p.price;
      const promoPrice = Number(ov.promoPrice) > 0 ? Number(ov.promoPrice) : null;
      const wholesalePrice = Number(ov.wholesaleTiers?.tier1) > 0 ? Number(ov.wholesaleTiers.tier1) : null;
      return {
        id: p.id,
        sku: skuFor(p),
        name: p.name,
        category: p.category,
        categoryLabel: p.categoryLabel,
        image: p.images[0]?.src,
        cost: ov.cost ?? PRODUCT_COSTS[p.category] ?? 0,
        price,
        promoPrice,
        wholesalePrice,
        // Preço/valor riscado REALMENTE em vigor na loja agora (considera
        // tanto a promoção específica deste produto quanto o desconto geral
        // da loja definido em Configurações, o que estiver ativo).
        effectivePrice: m.price,
        effectiveOldPrice: m.oldPrice,
        sizes: p.sizes,
        stockByColorSize: m.stockByColorSize,
        stockBySize: m.stockBySize,
        totalStock: m.totalStock,
        colors: p.colors,
        colorImages: p.colorImages,
        official: true,
        demo: false,
      };
    });

  const mock = mockProducts.map((p) => {
    const stockByColorSize = p.stockByColorSize || {};
    const stockBySize = aggregateStockBySize(p.sizes, stockByColorSize);
    return {
      ...p,
      stockByColorSize,
      stockBySize,
      totalStock: totalStock(stockBySize),
      promoPrice: Number(p.promoPrice) > 0 ? Number(p.promoPrice) : null,
      wholesalePrice: Number(p.wholesaleTiers?.tier1) > 0 ? Number(p.wholesaleTiers.tier1) : null,
      colorImages: p.colorImages || {},
      official: false,
      demo: true,
    };
  });

  return [...fromCatalog, ...mock].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getLowStockProducts(threshold = LOW_STOCK_THRESHOLD) {
  const products = await getAdminProducts();
  return products.filter((p) => p.totalStock <= threshold);
}

// Estoque é controlado por cor + tamanho, para permitir, por exemplo, ter
// 20 camisetas pretas no P e apenas 5 camisetas brancas no mesmo tamanho.
// Manda todos os tamanhos de UMA cor em uma única chamada (em vez de uma
// por tamanho) - evita que duas escritas paralelas na mesma linha do banco
// se sobrescrevam uma à outra.
export async function updateProductStockForColor(id, colorSlug, sizeQtyMap) {
  const clean = {};
  Object.entries(sizeQtyMap).forEach(([size, qty]) => { clean[size] = Math.max(0, Number(qty) || 0); });
  await apiPut(`/products/${id}`, { stockByColorSize: { [colorSlug]: clean } });
  invalidateProductsCache();
}

// Define o mesmo estoque para TODAS as cores e tamanhos de TODOS os
// produtos (oficiais + demonstração) de uma vez.
export async function setStockForAllProducts(qty) {
  await apiPost('/products/bulk-stock', { qty: Math.max(0, Number(qty) || 0) });
  invalidateProductsCache();
}

export async function updateProductPrice(id, price) {
  await apiPut(`/products/${id}`, { price: Number(price) });
  invalidateProductsCache();
}

// Preço promocional (opcional): quando definido e menor que o preço
// normal, passa a ser o preço efetivo exibido/cobrado na loja, no PDV e no
// painel, com o preço normal aparecendo riscado ao lado. Passar 0 ou null
// remove a promoção.
export async function updateProductPromoPrice(id, promoPrice) {
  const value = Number(promoPrice) > 0 ? Number(promoPrice) : null;
  await apiPut(`/products/${id}`, { promoPrice: value });
  invalidateProductsCache();
}

// Preço de atacado (tier1 - hoje só existe essa tabela, mas o campo já
// nasce como um objeto { tier1, tier2, tier3 } no banco, pronto para
// quando existir mais de uma tabela de atacado). Passar 0 ou null remove o
// preço de atacado - o produto volta a mostrar só o preço de varejo para
// clientes atacadistas.
export async function updateProductWholesalePrice(id, tier1) {
  const value = Number(tier1) > 0 ? Number(tier1) : null;
  await apiPut(`/products/${id}`, { wholesaleTiers: { tier1: value } });
  invalidateProductsCache();
}

export async function addMockProduct(data) {
  const { product } = await apiPost('/products', data);
  invalidateProductsCache();
  return product;
}

export async function deleteMockProduct(id) {
  await apiDelete(`/products/${id}`);
  invalidateProductsCache();
}

// Produtos oficiais não podem ser removidos do catálogo real por aqui
// (isso exigiria alterar o código-fonte da loja). "Excluir" um produto
// oficial apenas o esconde da listagem do painel administrativo.
export async function hideOfficialProduct(id) {
  await apiPut(`/products/${id}`, { action: 'hide' });
  invalidateSettingsCache();
}
