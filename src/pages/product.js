import { getCatalogProductBySlug, getCatalogRelated, getImagesForColor, isWholesaleSession } from '../services/catalogService.js';
import { formatBRL, installmentText, calcDiscountPercent } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { isFavorite, toggleFavorite } from '../context/favoritesStore.js';
import { addItem } from '../context/cartStore.js';
import { showToast } from '../components/toast.js';
import { openSizeGuide } from '../components/sizeGuide.js';
import { openCartDrawer } from '../components/cartDrawer.js';
import { renderProductGrid } from '../components/productCard.js';
import { navigate } from '../router.js';
import { bindGridInteractions } from './pageUtils.js';

let current = null;
let selectedColor = null;
let selectedColorSlug = null;
let selectedSize = null;
let qty = 1;
let currentImages = [];

export async function render(params, query = {}) {
  const slug = params[0];
  const product = await getCatalogProductBySlug(slug);
  current = product;

  if (!product) {
    return `
    <div class="empty-state">
      <div class="icon-circle">${icon('search', 'icon')}</div>
      <h3>Produto não encontrado.</h3>
      <p>O produto que você procura pode ter sido removido ou não existe mais.</p>
      <a href="#/produtos" class="btn btn-outline">Ver todos os produtos</a>
    </div>`;
  }

  const requestedColor = product.colors.find((c) => c.slug === query.cor);
  const initialColor = requestedColor || product.colors[0];

  selectedColor = initialColor?.name || null;
  selectedColorSlug = initialColor?.slug || null;
  selectedSize = null;
  qty = 1;
  currentImages = getImagesForColor(product, initialColor.slug);

  const related = await getCatalogRelated(product);

  return `
  <div class="product-detail">
    <div class="container">
      <div class="breadcrumbs" style="margin:24px 0;">
        <a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')}
        <a href="#/produtos?categoria=${product.category}">${escapeHtml(product.categoryLabel)}</a>
        ${icon('chevronRight', 'icon icon-sm')} <span>${escapeHtml(product.name)}</span>
      </div>

      <div class="product-detail-grid">
        <div class="gallery">
          <div class="gallery-main" id="gallery-main">
            <img id="gallery-main-img" src="${currentImages[0].src}" alt="${escapeHtml(currentImages[0].alt)}" onerror="window.__imgErr(this)">
          </div>
          <div class="gallery-thumbs" id="gallery-thumbs">
            ${renderThumbs(currentImages)}
          </div>
        </div>

        <div class="pd-info">
          <span class="pd-cat">${escapeHtml(product.categoryLabel)}</span>
          <h1 class="pd-title">${escapeHtml(product.name)}</h1>

          <div class="pd-price-block">
            ${product.wholesalePrice ? `<div style="margin-bottom:8px;"><span class="wholesale-badge">${icon('store', 'icon icon-sm')} Preço de atacado</span></div>` : ''}
            <span class="pd-price-current">${formatBRL(product.wholesalePrice || product.price)}</span>
            ${product.wholesalePrice
              ? `<span class="pd-price-old">${formatBRL(product.price)}</span> <span class="tag-badge sale">-${calcDiscountPercent(product.wholesalePrice, product.price)}%</span>`
              : product.oldPrice ? `<span class="pd-price-old">${formatBRL(product.oldPrice)}</span> <span class="tag-badge sale">-${calcDiscountPercent(product.price, product.oldPrice)}%</span>` : ''}
            <div class="pd-installments">${installmentText(product.wholesalePrice || product.price, 3)}</div>
            ${!product.wholesalePrice && !isWholesaleSession() ? `
              <div class="wholesale-cta">
                <p>Quer comprar com preço de atacado? <a href="#/atacado">Cadastre-se gratuitamente</a> e desbloqueie preços exclusivos para lojistas.</p>
              </div>` : ''}
          </div>

          <p class="pd-desc">${escapeHtml(product.description)}</p>

          <div class="option-block">
            <div class="option-label"><span>Escolha a cor: <strong id="selected-color-label">${escapeHtml(selectedColor || '')}</strong></span></div>
            <div class="color-thumb-row">
              ${product.colors.map((c) => `
                <button type="button" class="color-thumb ${c.name === selectedColor ? 'active' : ''}" data-color="${escapeHtml(c.name)}" data-color-slug="${c.slug}" title="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}" aria-pressed="${c.name === selectedColor}">
                  <img src="${product.colorImages[c.slug][0]}" alt="${escapeHtml(product.name)} - ${escapeHtml(c.name)}" loading="lazy" onerror="this.style.background='${c.hex}'; this.style.opacity=0.35;">
                  <span class="color-thumb-label">${escapeHtml(c.name)}</span>
                </button>`).join('')}
            </div>
          </div>

          <div class="option-block">
            <div class="option-label">
              <span>Tamanho</span>
              <button type="button" id="open-size-guide">Guia de tamanhos</button>
            </div>
            <div class="size-select-row" id="size-select-row">
              ${renderSizeButtons(product, initialColor.slug)}
            </div>
            <p class="form-hint" id="size-hint"></p>
          </div>

          <div class="option-block">
            <div class="option-label"><span>Quantidade</span></div>
            <div class="qty-selector">
              <button type="button" id="qty-minus" aria-label="Diminuir quantidade">${icon('minus', 'icon icon-sm')}</button>
              <span id="qty-value">1</span>
              <button type="button" id="qty-plus" aria-label="Aumentar quantidade">${icon('plus', 'icon icon-sm')}</button>
            </div>
          </div>

          <div class="pd-actions">
            <button class="btn btn-outline" id="add-to-cart-btn">${icon('bag', 'icon icon-sm')} Adicionar ao carrinho</button>
            <button class="btn btn-primary" id="buy-now-btn">Comprar agora</button>
            <button class="btn btn-icon pd-fav-btn ${isFavorite(product.id) ? 'active' : ''}" id="pd-fav-btn" aria-label="Favoritar produto" aria-pressed="${isFavorite(product.id)}">
              ${icon('heart')}
            </button>
          </div>

          <div class="trust-list">
            <div class="trust-item">${icon('truck')} <div><strong>Frete para todo o Brasil</strong>Calcule o prazo e valor na página do carrinho.</div></div>
            <div class="trust-item">${icon('refresh')} <div><strong>Trocas e devoluções</strong>Até 30 dias corridos após o recebimento.</div></div>
            <div class="trust-item">${icon('shield')} <div><strong>Compra 100% segura</strong>Seus dados protegidos do início ao fim.</div></div>
          </div>
        </div>
      </div>

      <div class="pd-tabs">
        <div class="tab-headers">
          <button class="active" data-tab="descricao">Descrição</button>
          <button data-tab="entrega">Frete &amp; Entrega</button>
        </div>
        <div class="tab-panel" data-panel="descricao">
          <p>${escapeHtml(product.description)}</p>
          <ul style="margin-top:14px;padding-left:18px;line-height:1.9;">
            ${product.composition.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
        <div class="tab-panel" data-panel="entrega" hidden>
          <p><strong>Prazo de entrega:</strong> de 3 a 12 dias úteis, conforme sua região, após a confirmação do pagamento.</p>
          <p style="margin-top:10px;"><strong>Trocas e devoluções:</strong> você tem até 30 dias corridos após o recebimento para solicitar troca ou devolução, desde que a peça esteja em perfeito estado, com etiquetas.</p>
          <p style="margin-top:10px;"><strong>Segurança da compra:</strong> todo o processo de pagamento é criptografado e seus dados nunca são compartilhados com terceiros.</p>
        </div>
      </div>

      ${related.length ? `
      <div class="related-section">
        <div class="section-head" style="text-align:left;margin-bottom:24px;">
          <h2 class="section-title" style="font-size:26px;">Outras peças da coleção</h2>
        </div>
        ${renderProductGrid(related)}
      </div>` : ''}
    </div>
  </div>`;
}

function renderSizeButtons(product, colorSlug) {
  const stockForColor = product.stockByColorSize?.[colorSlug] || {};
  return product.sizes.map((s) => {
    const stock = stockForColor[s] ?? 0;
    return `<button type="button" class="size-select" data-size="${s}" ${stock <= 0 ? 'disabled title="Indisponível nesta cor"' : ''}>${s}</button>`;
  }).join('');
}

function bindSizeEvents() {
  document.querySelectorAll('.size-select').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      selectedSize = btn.getAttribute('data-size');
      document.querySelectorAll('.size-select').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('size-hint').textContent = '';
    });
  });
}

// O carrinho guarda o preço já "congelado" no momento em que o item foi
// adicionado (ver context/cartStore.js) - por isso, se o produto tem preço
// de atacado desbloqueado, ele precisa ir como o `price` do item desde já,
// nunca recalculado depois (é o mesmo motivo por trás de o pedido salvo
// nunca mudar de valor mesmo que o preço do produto mude posteriormente).
function cartProduct(product) {
  return product.wholesalePrice ? { ...product, price: product.wholesalePrice } : product;
}

function renderThumbs(images) {
  return images.map((img, i) => `
    <button class="gallery-thumb ${i === 0 ? 'active' : ''}" data-thumb="${i}" aria-label="Ver imagem ${i + 1}">
      <img src="${img.src}" alt="${escapeHtml(img.alt)}" onerror="this.style.opacity=0">
    </button>`).join('');
}

export function afterRender() {
  if (!current) return;
  document.title = `${current.name} | GRATITUDE TÊXTIL`;
  const product = current;

  bindThumbEvents();

  const galleryMain = document.getElementById('gallery-main');
  galleryMain?.addEventListener('click', () => galleryMain.classList.toggle('zoomed'));

  document.querySelectorAll('[data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedColor = btn.getAttribute('data-color');
      const colorSlug = btn.getAttribute('data-color-slug');
      selectedColorSlug = colorSlug;
      document.querySelectorAll('[data-color]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('selected-color-label').textContent = selectedColor;

      currentImages = getImagesForColor(product, colorSlug);
      document.getElementById('gallery-main-img').src = currentImages[0].src;
      document.getElementById('gallery-main-img').alt = currentImages[0].alt;
      document.getElementById('gallery-thumbs').innerHTML = renderThumbs(currentImages);
      bindThumbEvents();

      // Cada cor tem seu próprio estoque por tamanho - ao trocar de cor,
      // atualiza quais tamanhos estão disponíveis e limpa a seleção atual.
      selectedSize = null;
      qty = 1;
      document.getElementById('qty-value').textContent = '1';
      document.getElementById('size-select-row').innerHTML = renderSizeButtons(product, colorSlug);
      document.getElementById('size-hint').textContent = '';
      bindSizeEvents();
    });
  });

  bindSizeEvents();

  document.getElementById('open-size-guide')?.addEventListener('click', () => openSizeGuide(product));

  const qtyValue = document.getElementById('qty-value');
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyValue.textContent = String(qty);
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    const maxStock = selectedSize ? product.stockByColorSize?.[selectedColorSlug]?.[selectedSize] : 99;
    qty = Math.min(maxStock || 99, qty + 1);
    qtyValue.textContent = String(qty);
  });

  function validateSelection() {
    if (!selectedSize) {
      const hint = document.getElementById('size-hint');
      hint.textContent = 'Selecione um tamanho para continuar.';
      hint.style.color = 'var(--color-error)';
      document.getElementById('size-select-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    if (!validateSelection()) return;
    addItem(cartProduct(product), selectedSize, selectedColor, qty);
    showToast(`${product.name} adicionado ao carrinho!`, 'success');
    openCartDrawer();
  });

  document.getElementById('buy-now-btn')?.addEventListener('click', () => {
    if (!validateSelection()) return;
    addItem(cartProduct(product), selectedSize, selectedColor, qty);
    navigate('/checkout');
  });

  document.getElementById('pd-fav-btn')?.addEventListener('click', (e) => {
    const nowFav = toggleFavorite(product.id);
    e.currentTarget.classList.toggle('active', nowFav);
    e.currentTarget.setAttribute('aria-pressed', String(nowFav));
    showToast(nowFav ? 'Adicionado aos favoritos' : 'Removido dos favoritos', nowFav ? 'success' : 'info', 2000);
  });

  document.querySelectorAll('.tab-headers button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-headers button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.hidden = p.getAttribute('data-panel') !== tab;
      });
    });
  });

  bindGridInteractions(document.getElementById('app'));
}

function bindThumbEvents() {
  document.querySelectorAll('[data-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-thumb'));
      document.getElementById('gallery-main-img').src = currentImages[i].src;
      document.getElementById('gallery-main-img').alt = currentImages[i].alt;
      document.querySelectorAll('[data-thumb]').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
