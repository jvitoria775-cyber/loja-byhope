import { formatBRL, calcDiscountPercent } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { isFavorite } from '../context/favoritesStore.js';
import { icon } from './icons.js';

// Card de uma peça, exibindo UMA cor especifica como se fosse a foto
// principal de um produto — usado nas listagens (categoria/home) para que
// cada cor apareca em destaque, lado a lado, como se fossem varios produtos.
// Todos os cards de um mesmo modelo apontam para a MESMA pagina de produto
// (apenas com a cor pre-selecionada via ?cor=), nunca criando produto novo.
export function renderProductCard(p, color, delayIndex = 0) {
  const fav = isFavorite(p.id);
  const images = p.colorImages[color.slug] || p.images.map((i) => i.src);
  const secondImage = images[1] || images[0];

  return `
  <article class="product-card fade-in" style="animation-delay:${Math.min(delayIndex * 0.05, 0.4)}s" data-product-id="${p.id}" data-color-slug="${color.slug}">
    <div class="product-media">
      <a href="#/produto/${p.slug}?cor=${color.slug}" aria-label="Ver detalhes de ${escapeHtml(p.name)} na cor ${escapeHtml(color.name)}">
        <div class="media">
          <img class="img-primary" src="${images[0]}" alt="${escapeHtml(p.name)} - ${escapeHtml(color.name)}" loading="lazy" onerror="window.__imgErr(this)">
          <img class="img-secondary" src="${secondImage}" alt="${escapeHtml(p.name)} - ${escapeHtml(color.name)} - outra vista" loading="lazy" onerror="this.style.display='none'">
          <div class="media-fallback"><span>GT</span></div>
        </div>
      </a>
      ${p.oldPrice ? `<div class="product-badges"><span class="tag-badge sale">-${calcDiscountPercent(p.price, p.oldPrice)}%</span></div>` : ''}
      <button class="fav-toggle ${fav ? 'active' : ''}" data-fav-btn="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
        ${icon('heart')}
      </button>
      <div class="quick-add">
        <button class="btn btn-light btn-sm" data-quick-add="${p.id}" data-quick-add-color="${color.slug}">
          ${icon('bag', 'icon icon-sm')} Adicionar ao carrinho
        </button>
      </div>
    </div>
    <div class="product-info">
      <span class="product-cat">${escapeHtml(p.categoryLabel)}</span>
      <h3 class="product-name"><a href="#/produto/${p.slug}?cor=${color.slug}">${escapeHtml(p.name)}</a></h3>
      <div class="product-price-row">
        <span class="price-current">${formatBRL(p.price)}</span>
        ${p.oldPrice ? `<span class="price-old">${formatBRL(p.oldPrice)}</span><span class="price-discount">-${calcDiscountPercent(p.price, p.oldPrice)}%</span>` : ''}
      </div>
      <div class="product-color-name"><span class="color-swatch-mini" style="background:${color.hex}"></span>${escapeHtml(color.name)}</div>
    </div>
  </article>`;
}

// Expande cada produto em um card por cor (ou apenas pelas cores filtradas,
// quando um filtro de cor estiver ativo). Continua sendo o MESMO produto —
// so muda a foto/cor pre-selecionada de cada card.
export function renderVariantGrid(products, { colorFilter = [] } = {}) {
  const cards = [];
  products.forEach((p) => {
    const colors = colorFilter.length
      ? p.colors.filter((c) => colorFilter.includes(c.name))
      : p.colors;
    colors.forEach((c) => cards.push({ product: p, color: c }));
  });

  if (!cards.length) {
    return { html: emptyStateHtml(), count: 0 };
  }

  const html = `<div class="product-grid">${cards.map((c, i) => renderProductCard(c.product, c.color, i)).join('')}</div>`;
  return { html, count: cards.length };
}

function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="icon-circle">${icon('search', 'icon')}</div>
      <h3>Nenhum produto encontrado.</h3>
      <p>Tente buscar por outro termo, como "camiseta" ou "moletom", ou ajuste os filtros selecionados.</p>
      <a href="#/produtos" class="btn btn-outline">Ver todos os produtos</a>
    </div>`;
}

// Grid simples (uma peca = um card, na cor padrao) — usado em secoes
// secundarias como favoritos e "produtos relacionados".
export function renderProductGrid(list) {
  if (!list.length) return emptyStateHtml();
  return `<div class="product-grid">${list.map((p, i) => renderProductCard(p, p.colors[0], i)).join('')}</div>`;
}

export function renderSkeletonGrid(count = 8) {
  return `<div class="product-grid">${Array.from({ length: count }).map(() => `
    <div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-line" style="width:60%"></div>
      <div class="skeleton skeleton-line" style="width:40%"></div>
    </div>`).join('')}</div>`;
}
