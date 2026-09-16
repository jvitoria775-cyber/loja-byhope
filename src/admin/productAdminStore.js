// Camada administrativa de produtos. NUNCA escreve em src/data/products.js
// (a fonte real do catálogo da loja) - em vez disso guarda ajustes (estoque,
// preço, preço promocional) e produtos de demonstração criados aqui em uma
// camada separada no localStorage (chave "product_overrides"), e devolve a
// lista já "mesclada" para exibição no painel. Essa mesma camada de ajustes
// é lida por src/services/catalogService.js, usado pela loja e pelo PDV -
// ou seja, uma alteração de estoque/preço feita aqui aparece imediatamente
// na vitrine e no caixa. Isso deixa a tela pronta para uso e edição, mas o
// ideal para produção é substituir esta camada por chamadas reais a um
// backend/banco de dados.
import { products as realProducts } from '../data/products.js';
import { getCatalogProducts } from '../services/catalogService.js';
import { getItem, setItem } from '../utils/storage.js';

const OVERRIDES_KEY = 'product_overrides';
const MOCK_PRODUCTS_KEY = 'mock_products';
const HIDDEN_KEY = 'hidden_products';

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

function getOverrides() { return getItem(OVERRIDES_KEY, {}); }
function saveOverrides(o) { setItem(OVERRIDES_KEY, o); }
function getMockProducts() { return getItem(MOCK_PRODUCTS_KEY, []); }
function saveMockProducts(list) { setItem(MOCK_PRODUCTS_KEY, list); }
function getHidden() { return getItem(HIDDEN_KEY, []); }

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

export function getAdminProducts() {
  const overrides = getOverrides();
  const hidden = new Set(getHidden());
  // getCatalogProducts() já calcula o estoque mesclado (por cor+tamanho e
  // agregado) - reaproveitamos aqui para não duplicar essa lógica.
  const merged = new Map(getCatalogProducts().map((p) => [p.id, p]));

  const fromCatalog = realProducts
    .filter((p) => !hidden.has(p.id))
    .map((p) => {
      const ov = overrides[p.id] || {};
      const m = merged.get(p.id);
      const price = ov.price ?? p.price;
      const promoPrice = Number(ov.promoPrice) > 0 ? Number(ov.promoPrice) : null;
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

  const mock = getMockProducts().map((p) => {
    const stockByColorSize = p.stockByColorSize || {};
    const stockBySize = aggregateStockBySize(p.sizes, stockByColorSize);
    return {
      ...p,
      stockByColorSize,
      stockBySize,
      totalStock: totalStock(stockBySize),
      promoPrice: Number(p.promoPrice) > 0 ? Number(p.promoPrice) : null,
      colorImages: p.colorImages || {},
      official: false,
      demo: true,
    };
  });

  return [...fromCatalog, ...mock].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function getLowStockProducts(threshold = LOW_STOCK_THRESHOLD) {
  return getAdminProducts().filter((p) => p.totalStock <= threshold);
}

// Estoque é controlado por cor + tamanho, para permitir, por exemplo, ter
// 20 camisetas pretas no P e apenas 5 camisetas brancas no mesmo tamanho.
export function updateProductStock(id, colorSlug, size, qty) {
  const value = Math.max(0, Number(qty) || 0);
  const isMock = getMockProducts().some((p) => p.id === id);
  if (isMock) {
    const list = getMockProducts();
    const item = list.find((p) => p.id === id);
    if (item) {
      item.stockByColorSize = item.stockByColorSize || {};
      item.stockByColorSize[colorSlug] = item.stockByColorSize[colorSlug] || {};
      item.stockByColorSize[colorSlug][size] = value;
      saveMockProducts(list);
    }
    return;
  }
  const overrides = getOverrides();
  overrides[id] = overrides[id] || {};
  overrides[id].stockByColorSize = overrides[id].stockByColorSize || {};
  overrides[id].stockByColorSize[colorSlug] = overrides[id].stockByColorSize[colorSlug] || {};
  overrides[id].stockByColorSize[colorSlug][size] = value;
  saveOverrides(overrides);
}

// Define o mesmo estoque para TODAS as cores e tamanhos de TODOS os
// produtos (oficiais + demonstração) de uma vez - útil para "zerar" o
// controle de estoque com um valor alto (ex.: 999) em vez de editar
// produto por produto.
export function setStockForAllProducts(qty) {
  const value = Math.max(0, Number(qty) || 0);

  const overrides = getOverrides();
  realProducts.forEach((p) => {
    overrides[p.id] = overrides[p.id] || {};
    overrides[p.id].stockByColorSize = overrides[p.id].stockByColorSize || {};
    p.colors.forEach((c) => {
      overrides[p.id].stockByColorSize[c.slug] = overrides[p.id].stockByColorSize[c.slug] || {};
      p.sizes.forEach((s) => { overrides[p.id].stockByColorSize[c.slug][s] = value; });
    });
  });
  saveOverrides(overrides);

  const mockList = getMockProducts();
  mockList.forEach((p) => {
    p.stockByColorSize = p.stockByColorSize || {};
    (p.colors || []).forEach((c) => {
      p.stockByColorSize[c.slug] = p.stockByColorSize[c.slug] || {};
      (p.sizes || []).forEach((s) => { p.stockByColorSize[c.slug][s] = value; });
    });
  });
  saveMockProducts(mockList);
}

export function updateProductPrice(id, price) {
  const isMock = getMockProducts().some((p) => p.id === id);
  if (isMock) {
    const list = getMockProducts();
    const item = list.find((p) => p.id === id);
    if (item) { item.price = price; saveMockProducts(list); }
    return;
  }
  const overrides = getOverrides();
  overrides[id] = overrides[id] || {};
  overrides[id].price = price;
  saveOverrides(overrides);
}

// Preço promocional (opcional): quando definido e menor que o preço
// normal, passa a ser o preço efetivo exibido/cobrado na loja, no PDV e no
// painel, com o preço normal aparecendo riscado ao lado. Passar 0 ou null
// remove a promoção.
export function updateProductPromoPrice(id, promoPrice) {
  const value = Number(promoPrice) > 0 ? Number(promoPrice) : null;
  const isMock = getMockProducts().some((p) => p.id === id);
  if (isMock) {
    const list = getMockProducts();
    const item = list.find((p) => p.id === id);
    if (item) { item.promoPrice = value; saveMockProducts(list); }
    return;
  }
  const overrides = getOverrides();
  overrides[id] = overrides[id] || {};
  overrides[id].promoPrice = value;
  saveOverrides(overrides);
}

export function addMockProduct(data) {
  const list = getMockProducts();
  const id = `mock-${Date.now()}`;
  const sizes = ['P', 'M', 'G', 'GG'];
  const perSize = Number(data.stock) || 0;
  const colorSlug = 'padrao';
  const stockByColorSize = { [colorSlug]: {} };
  sizes.forEach((s) => { stockByColorSize[colorSlug][s] = perSize; });

  const product = {
    id,
    sku: `GT-DEMO-${list.length + 1}`,
    name: data.name,
    category: data.category,
    categoryLabel: data.categoryLabel,
    image: data.image || '',
    cost: Number(data.cost) || 0,
    price: Number(data.price) || 0,
    sizes,
    stockByColorSize,
    colors: [{ name: 'Padrão', slug: colorSlug, hex: '#C9962E' }],
    colorImages: data.image ? { [colorSlug]: [data.image] } : {},
  };
  list.push(product);
  saveMockProducts(list);
  return product;
}

export function deleteMockProduct(id) {
  saveMockProducts(getMockProducts().filter((p) => p.id !== id));
}

// Produtos oficiais não podem ser removidos do catálogo real por aqui
// (isso exigiria alterar o código-fonte da loja). "Excluir" um produto
// oficial apenas o esconde da listagem do painel administrativo.
export function hideOfficialProduct(id) {
  const hidden = getHidden();
  if (!hidden.includes(id)) {
    hidden.push(id);
    setItem(HIDDEN_KEY, hidden);
  }
}
