import { products } from '../data/products.js';
import { filterAndSort, getAvailableColors } from '../services/productService.js';
import { renderVariantGrid } from '../components/productCard.js';
import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/dom.js';
import { bindGridInteractions } from './pageUtils.js';

const SIZES = ['PP', 'P', 'M', 'G', 'GG'];

const CATEGORIES = Array.from(
  products.reduce((map, p) => map.set(p.category, p.categoryLabel), new Map()),
  ([value, label]) => ({ value, label })
);

let state = {
  query: '', category: '', tag: '', sizes: [], colors: [],
  priceMin: null, priceMax: null, sort: 'relevancia',
};

const TAG_TITLES = {
  novidades: 'Novidades',
};

export function render(params, query) {
  state = {
    query: query.busca || '',
    category: query.categoria || '',
    tag: query.tag || '',
    sizes: query.tamanho ? query.tamanho.split(',') : [],
    colors: query.cor ? query.cor.split(',') : [],
    priceMin: query.min ? Number(query.min) : null,
    priceMax: query.max ? Number(query.max) : null,
    sort: query.ordenar || 'relevancia',
  };

  const availableColors = getAvailableColors(products);
  const title = pageTitle();

  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs">
        <a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')} <span>${title}</span>
      </div>
      <h1>${title}</h1>
      <p class="result-count" id="result-count"></p>
    </div>
  </div>

  <div class="container">
    <div class="catalog-layout">
      <aside class="filters-panel" id="filters-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <strong style="font-size:14.5px;">Filtros</strong>
          <div style="display:flex;gap:14px;align-items:center;">
            <button class="clear-filters" id="clear-filters">Limpar tudo</button>
            <button class="btn-icon" id="close-filters" style="display:none;" aria-label="Fechar filtros">${icon('x')}</button>
          </div>
        </div>

        <div class="filter-group">
          <h4>Categoria</h4>
          <label class="filter-option"><input type="radio" name="f-category" value="" ${!state.category ? 'checked' : ''}> Todas</label>
          ${CATEGORIES.map((c) => `<label class="filter-option"><input type="radio" name="f-category" value="${c.value}" ${state.category === c.value ? 'checked' : ''}> ${escapeHtml(c.label)}</label>`).join('')}
        </div>

        <div class="filter-group">
          <h4>Tamanho</h4>
          <div class="size-chip-group">
            ${SIZES.map((s) => `<button type="button" class="size-chip ${state.sizes.includes(s) ? 'active' : ''}" data-size-filter="${s}">${s}</button>`).join('')}
          </div>
        </div>

        <div class="filter-group">
          <h4>Cor</h4>
          <div class="color-chip-group">
            ${availableColors.map((c) => `<button type="button" class="color-chip ${state.colors.includes(c.name) ? 'active' : ''}" style="background:${c.hex}" data-color-filter="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}"></button>`).join('')}
          </div>
        </div>

        <div class="filter-group">
          <h4>Faixa de preço</h4>
          <div class="price-range-row">
            <input type="number" id="price-min" placeholder="Mín." min="0" value="${state.priceMin ?? ''}" />
            <span>—</span>
            <input type="number" id="price-max" placeholder="Máx." min="0" value="${state.priceMax ?? ''}" />
          </div>
          <button class="btn btn-outline btn-sm btn-block" id="apply-price" style="margin-top:12px;">Aplicar</button>
        </div>
      </aside>

      <div class="catalog-main">
        <div class="catalog-toolbar">
          <button class="btn btn-outline btn-sm mobile-filter-btn" id="open-filters">${icon('filter', 'icon icon-sm')} Filtros</button>
          <select class="sort-select" id="sort-select">
            <option value="relevancia" ${state.sort === 'relevancia' ? 'selected' : ''}>Ordem alfabética</option>
            <option value="menor-preco" ${state.sort === 'menor-preco' ? 'selected' : ''}>Menor preço</option>
            <option value="maior-preco" ${state.sort === 'maior-preco' ? 'selected' : ''}>Maior preço</option>
            <option value="mais-recentes" ${state.sort === 'mais-recentes' ? 'selected' : ''}>Mais recentes</option>
          </select>
        </div>
        <div id="catalog-grid"></div>
      </div>
    </div>
  </div>`;
}

function pageTitle() {
  if (state.query) return `Resultados para "${state.query}"`;
  if (state.tag) return TAG_TITLES[state.tag] || 'Produtos';
  const cat = CATEGORIES.find((c) => c.value === state.category);
  if (cat) return cat.label;
  return 'Todos os Produtos';
}

function renderGrid() {
  const list = filterAndSort(products, state);
  const { html, count: total } = renderVariantGrid(list, { colorFilter: state.colors });
  const grid = document.getElementById('catalog-grid');
  const countEl = document.getElementById('result-count');
  if (grid) {
    grid.innerHTML = html;
    bindGridInteractions(grid);
  }
  if (countEl) {
    countEl.textContent = total === 0 ? '' : `${total} produto${total > 1 ? 's' : ''} encontrado${total > 1 ? 's' : ''}`;
  }
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set('busca', state.query);
  if (state.category) params.set('categoria', state.category);
  if (state.tag) params.set('tag', state.tag);
  if (state.sizes.length) params.set('tamanho', state.sizes.join(','));
  if (state.colors.length) params.set('cor', state.colors.join(','));
  if (state.priceMin != null) params.set('min', state.priceMin);
  if (state.priceMax != null) params.set('max', state.priceMax);
  if (state.sort !== 'relevancia') params.set('ordenar', state.sort);
  const qs = params.toString();
  history.replaceState(null, '', `#/produtos${qs ? '?' + qs : ''}`);
}

export function afterRender() {
  document.title = `${pageTitle()} | GRATITUDE TÊXTIL`;
  renderGrid();

  document.querySelectorAll('[name="f-category"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      state.category = e.target.value;
      state.tag = '';
      syncUrl();
      renderGrid();
      document.title = `${pageTitle()} | GRATITUDE TÊXTIL`;
      document.querySelector('.page-header h1').textContent = pageTitle();
    });
  });

  document.querySelectorAll('[data-size-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.getAttribute('data-size-filter');
      if (state.sizes.includes(size)) {
        state.sizes = state.sizes.filter((s) => s !== size);
      } else {
        state.sizes.push(size);
      }
      btn.classList.toggle('active');
      syncUrl();
      renderGrid();
    });
  });

  document.querySelectorAll('[data-color-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color-filter');
      if (state.colors.includes(color)) {
        state.colors = state.colors.filter((c) => c !== color);
      } else {
        state.colors.push(color);
      }
      btn.classList.toggle('active');
      syncUrl();
      renderGrid();
    });
  });

  document.getElementById('apply-price')?.addEventListener('click', () => {
    const min = document.getElementById('price-min').value;
    const max = document.getElementById('price-max').value;
    state.priceMin = min ? Number(min) : null;
    state.priceMax = max ? Number(max) : null;
    syncUrl();
    renderGrid();
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    syncUrl();
    renderGrid();
  });

  document.getElementById('clear-filters')?.addEventListener('click', () => {
    state = { query: state.query, category: '', tag: '', sizes: [], colors: [], priceMin: null, priceMax: null, sort: 'relevancia' };
    syncUrl();
    document.getElementById('app').innerHTML = render([], Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')));
    afterRender();
  });

  const filtersPanel = document.getElementById('filters-panel');
  const openBtn = document.getElementById('open-filters');
  const closeBtn = document.getElementById('close-filters');
  openBtn?.addEventListener('click', () => {
    filtersPanel.classList.add('open');
    closeBtn.style.display = 'inline-flex';
    document.body.style.overflow = 'hidden';
  });
  closeBtn?.addEventListener('click', () => {
    filtersPanel.classList.remove('open');
    closeBtn.style.display = 'none';
    document.body.style.overflow = '';
  });
}
