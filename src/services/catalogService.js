// Camada compartilhada de leitura do catálogo. Loja, PDV e painel
// administrativo passam a ler os produtos por aqui. Os ajustes de
// estoque/preço/promoção e o desconto geral da loja agora vivem num banco
// de dados compartilhado (Postgres, via as funções em /api) em vez de
// localStorage - assim, uma alteração feita no painel por qualquer
// computador aparece para qualquer visitante, em qualquer aparelho.
//
// GET /api/products e GET /api/settings são endpoints públicos (sem PIN),
// de propósito: qualquer visitante da loja precisa poder ver o
// estoque/preço atual. Os dados são carregados uma vez e guardados em
// memória (cache por carregamento de página) para não bater na rede a
// cada clique de filtro - invalidateCatalogCache() força recarregar depois
// de uma escrita feita no painel.
import { products as rawProducts, getImagesForColor } from '../data/products.js';
import { getItem } from '../utils/storage.js';

let _cache = null;
let _cachePromise = null;

// Lê o token de cliente atacadista direto do localStorage (mesma chave
// usada por src/context/authStore.js) em vez de importar authStore.js
// aqui - authStore.js já importa invalidateCatalogCache() deste arquivo,
// e um import circular entre os dois seria frágil.
function getWholesaleToken() {
  return getItem('wholesale_session', null)?.token || null;
}

async function loadState() {
  if (_cache) return _cache;
  if (!_cachePromise) {
    const token = getWholesaleToken();
    const productsHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

    _cachePromise = Promise.all([
      fetch('/api/products', { headers: productsHeaders }).then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
      .then(([productsRes, settingsRes]) => {
        _cache = {
          overrides: productsRes.overrides || {},
          discountPercent: Number(settingsRes.discountPercent) || 0,
          isWholesale: !!token,
        };
        return _cache;
      })
      .catch((err) => {
        _cachePromise = null;
        throw err;
      });
  }
  return _cachePromise;
}

export function invalidateCatalogCache() {
  _cache = null;
  _cachePromise = null;
}

// Se o visitante atual está autenticado como cliente atacadista (usado
// pela página de produto para decidir entre mostrar o preço de atacado ou
// a chamada para cadastro - só sabe isso depois que loadState() já rodou
// ao menos uma vez nesta sessão de navegação).
export function isWholesaleSession() {
  return !!_cache?.isWholesale;
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

// Aplica o estoque/preço vindos do banco por cima do produto real.
//
// Estoque é controlado por COR + TAMANHO: o banco guarda ajustes em
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
//    resulte exatamente no preço de venda real.
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

  // wholesaleTiers só vem preenchido na resposta da API quando o servidor
  // já validou que quem pediu tem direito a ver preço de atacado (admin do
  // painel ou cliente atacadista autenticado) - ver api/products/index.js.
  // Fica como um campo À PARTE (não mexe em price/oldPrice, que continuam
  // sendo sempre o preço de VAREJO) - assim o painel administrativo, que
  // reaproveita esta mesma função para a coluna de preço normal, nunca
  // mistura os dois; quem decide usar o preço de atacado no lugar do
  // varejo é a página de produto, explicitamente.
  const wholesalePrice = Number(ov.wholesaleTiers?.tier1) > 0 ? Number(ov.wholesaleTiers.tier1) : null;

  return {
    ...p,
    stockByColorSize,
    stockBySize,
    totalStock,
    price,
    oldPrice,
    wholesalePrice,
  };
}

export async function getCatalogProducts() {
  const { overrides, discountPercent } = await loadState();
  return rawProducts.map((p) => applyOverride(p, overrides, discountPercent));
}

export async function getCatalogProductBySlug(slug) {
  const { overrides, discountPercent } = await loadState();
  const p = rawProducts.find((x) => x.slug === slug || x.id === slug);
  return p ? applyOverride(p, overrides, discountPercent) : null;
}

export async function getCatalogRelated(product, limit = 4) {
  const list = await getCatalogProducts();
  return list.filter((p) => p.id !== product.id).slice(0, limit);
}

export { getImagesForColor };
