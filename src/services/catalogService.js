// Camada compartilhada de leitura do catálogo. Loja, PDV e painel
// administrativo passam a ler os produtos por aqui, em vez de importar
// `data/products.js` direto - assim, um ajuste de estoque/preço/promoção
// feito no painel (guardado em localStorage, chave "product_overrides")
// aparece imediatamente no site e no PDV, sem nunca alterar o arquivo de
// origem do catálogo real.
import { products as rawProducts, getImagesForColor } from '../data/products.js';
import { getItem, setItem } from '../utils/storage.js';

const OVERRIDES_KEY = 'product_overrides';
const STORE_DISCOUNT_KEY = 'store_discount_percent';

// Desconto padrão aplicado a toda a loja (produtos sem promoção específica
// definida no painel). Fica ativo por padrão em qualquer navegador - a
// equipe pode alterar ou desativar (0%) a qualquer momento em
// Configurações > Promoção da loja.
const DEFAULT_STORE_DISCOUNT_PERCENT = 27;

function getOverrides() {
  return getItem(OVERRIDES_KEY, {});
}

export function getStoreDiscountPercent() {
  const value = Number(getItem(STORE_DISCOUNT_KEY, DEFAULT_STORE_DISCOUNT_PERCENT));
  return value > 0 && value < 100 ? value : 0;
}

export function setStoreDiscountPercent(percent) {
  const value = Number(percent);
  setItem(STORE_DISCOUNT_KEY, value > 0 && value < 100 ? value : 0);
}

// Arredonda para cima até a casa ",90" mais próxima (nunca abaixo do valor
// dado) - mesma convenção comercial usada no preço original do catálogo
// (ver comentário em data/products.js). Usado só para o preço "de"
// (riscado) inflado do desconto geral da loja, nunca para o valor cobrado.
function roundUpToNinety(value) {
  const intPart = Math.floor(value);
  let candidate = intPart + 0.9;
  if (candidate < value - 1e-9) candidate += 1;
  return Math.round(candidate * 100) / 100;
}

// Aplica o estoque/preço salvos no painel por cima do produto real.
//
// Estoque agora é controlado por COR + TAMANHO: o painel guarda ajustes em
// `stockByColorSize[corSlug][tamanho]`. Quando uma cor ainda não tem ajuste
// para um tamanho, usamos como ponto de partida o `stockBySize` original do
// produto (o mesmo valor "cheio" para todas as cores) - é um placeholder,
// já que nunca houve dado real de estoque por cor; assim que a loja
// preenche números reais no painel, eles substituem esse padrão.
// `stockBySize` no produto final passa a ser a SOMA de todas as cores por
// tamanho (estoque agregado, usado em telas que não dependem da cor).
//
// Preço: existem duas formas de "promoção", com efeitos diferentes no
// valor realmente cobrado:
//  - Promoção ESPECÍFICA do produto (promoPrice, definida em Produtos &
//    Estoque): é uma redução de preço DE VERDADE - o valor cobrado cai
//    para o promoPrice, e o preço normal fica riscado ao lado.
//  - Desconto GERAL da loja (Configurações > Promoção da loja): é só uma
//    vitrine - o preço de venda cadastrado (`normalPrice`) É o valor
//    cobrado e continua exatamente o mesmo; o que aparece é um preço "de"
//    riscado MAIOR, calculado de forma que aplicar o desconto sobre ele
//    resulte exatamente no preço de venda real. Ou seja, o desconto geral
//    nunca reduz o quanto a loja recebe.
function applyOverride(p, overrides, storeDiscountPercent) {
  const ov = overrides[p.id] || {};

  const stockByColorSize = {};
  p.colors.forEach((c) => {
    stockByColorSize[c.slug] = { ...p.stockBySize, ...(ov.stockByColorSize?.[c.slug] || {}) };
  });

  const stockBySize = {};
  p.sizes.forEach((s) => {
    stockBySize[s] = p.colors.reduce((sum, c) => sum + (Number(stockByColorSize[c.slug][s]) || 0), 0);
  });
  const totalStock = Object.values(stockBySize).reduce((s, n) => s + n, 0);

  const normalPrice = ov.price ?? p.price;
  const hasOwnPromo = Number(ov.promoPrice) > 0 && Number(ov.promoPrice) < normalPrice;

  let price = normalPrice;
  let oldPrice;
  if (hasOwnPromo) {
    price = Number(ov.promoPrice);
    oldPrice = normalPrice;
  } else if (storeDiscountPercent > 0) {
    price = normalPrice;
    oldPrice = roundUpToNinety(normalPrice / (1 - storeDiscountPercent / 100));
  }

  return {
    ...p,
    stockByColorSize,
    stockBySize,
    totalStock,
    price,
    oldPrice,
  };
}

export function getCatalogProducts() {
  const overrides = getOverrides();
  const storeDiscountPercent = getStoreDiscountPercent();
  return rawProducts.map((p) => applyOverride(p, overrides, storeDiscountPercent));
}

export function getCatalogProductBySlug(slug) {
  const overrides = getOverrides();
  const storeDiscountPercent = getStoreDiscountPercent();
  const p = rawProducts.find((x) => x.slug === slug || x.id === slug);
  return p ? applyOverride(p, overrides, storeDiscountPercent) : null;
}

export function getCatalogRelated(product, limit = 4) {
  return getCatalogProducts().filter((p) => p.id !== product.id).slice(0, limit);
}

export { getImagesForColor };
