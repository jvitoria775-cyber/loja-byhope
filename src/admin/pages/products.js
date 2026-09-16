import { getAdminProducts, updateProductStock, updateProductPrice, updateProductPromoPrice, addMockProduct, deleteMockProduct, hideOfficialProduct, PRODUCT_COSTS } from '../productAdminStore.js';
import { formatBRL, calcDiscountPercent } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

const LOW_STOCK_THRESHOLD = 10;
let state = { search: '', category: '' };

export async function render() {
  const products = getAdminProducts();
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  return `
    <div class="panel">
      <div class="table-toolbar">
        <input type="search" id="search-input" placeholder="Buscar por nome ou SKU..." value="${escapeHtml(state.search)}" />
        <select id="category-filter">
          <option value="">Todas as categorias</option>
          ${categories.map((c) => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${escapeHtml(products.find((p) => p.category === c)?.categoryLabel || c)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary btn-sm" id="new-product-btn">${icon('plus', 'icon icon-sm')} Novo produto</button>
      </div>
      <div id="products-table-wrap"></div>
    </div>
    <div id="product-modal-root"></div>
  `;
}

// Preço "efetivo" exibido na tabela: considera a promoção específica do
// produto OU, na ausência dela, o desconto geral da loja (Configurações) -
// exatamente o que aparece para o cliente na vitrine.
function priceCellHtml(p) {
  const effectivePrice = p.effectivePrice ?? p.promoPrice ?? p.price;
  const oldPrice = p.effectiveOldPrice ?? (p.promoPrice ? p.price : null);
  if (!oldPrice) return formatBRL(p.price);
  return `<span style="color:var(--color-text-faint);text-decoration:line-through;font-size:11.5px;">${formatBRL(oldPrice)}</span><br><strong style="color:#B3452C;">${formatBRL(effectivePrice)}</strong> <span class="badge-pill badge-cancelado">-${calcDiscountPercent(effectivePrice, oldPrice)}%</span>`;
}

function getFiltered() {
  return getAdminProducts().filter((p) => {
    if (state.category && p.category !== state.category) return false;
    if (state.search) {
      const term = state.search.toLowerCase();
      if (!`${p.name} ${p.sku}`.toLowerCase().includes(term)) return false;
    }
    return true;
  });
}

function renderTable() {
  const wrap = document.getElementById('products-table-wrap');
  const products = getFiltered();

  if (!products.length) {
    wrap.innerHTML = `<div class="empty-note"><strong>Nenhum produto encontrado.</strong><span>Ajuste os filtros ou cadastre um novo produto.</span></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr><th></th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Cores</th><th>Custo</th><th>Preço</th><th>Estoque</th><th></th></tr>
      </thead>
      <tbody>
        ${products.map((p) => `
          <tr data-product-id="${p.id}">
            <td><img src="${p.image || ''}" alt="" class="table-thumb" onerror="this.style.visibility='hidden'"></td>
            <td><strong>${escapeHtml(p.name)}</strong>${p.demo ? ' <span class="badge-pill badge-pendente">demo</span>' : ''}</td>
            <td>${escapeHtml(p.sku)}</td>
            <td>${escapeHtml(p.categoryLabel || p.category)}</td>
            <td>${(p.colors || []).length} cor(es)</td>
            <td>${formatBRL(p.cost)}</td>
            <td>${priceCellHtml(p)}</td>
            <td>${p.totalStock <= LOW_STOCK_THRESHOLD ? `<span class="badge-pill badge-pendente">${p.totalStock} un.</span>` : `${p.totalStock} un.`}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-edit="${p.id}">${icon('edit', 'icon icon-sm')} Editar</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-edit')));
  });
}

function openEditModal(id) {
  const product = getAdminProducts().find((p) => p.id === id);
  if (!product) return;
  const root = document.getElementById('product-modal-root');
  let activeColorSlug = product.colors?.[0]?.slug || null;

  function stockSectionHtml() {
    const colorName = product.colors.find((c) => c.slug === activeColorSlug)?.name || '';
    const stockForColor = product.stockByColorSize?.[activeColorSlug] || {};
    return `
      <strong style="font-size:12.5px;">Estoque por tamanho — ${escapeHtml(colorName)}</strong>
      <p style="font-size:11.5px;color:var(--color-text-faint);margin:4px 0 6px;">Clique em uma cor acima para editar o estoque dela — cada cor tem seu próprio estoque por tamanho.</p>
      <div class="stock-edit-grid">
        ${(product.sizes || []).map((size) => `
          <div class="stock-edit-row">
            <span>${escapeHtml(size)}</span>
            <input type="number" min="0" data-size="${escapeHtml(size)}" value="${stockForColor[size] ?? 0}">
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-outline btn-sm btn-block" id="save-stock-btn" style="margin-top:10px;">Salvar estoque desta cor</button>
      <span id="stock-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Estoque salvo.</span>
    `;
  }

  // Salva os valores atualmente visíveis na grade (da cor ativa) antes de
  // trocar de cor ou fechar o modal, para nunca perder uma edição feita
  // mas não confirmada explicitamente.
  function persistCurrentStockInputs() {
    if (!activeColorSlug) return;
    document.querySelectorAll('#stock-section [data-size]').forEach((input) => {
      const size = input.getAttribute('data-size');
      const qty = Number(input.value) || 0;
      updateProductStock(product.id, activeColorSlug, size, qty);
      product.stockByColorSize[activeColorSlug] = product.stockByColorSize[activeColorSlug] || {};
      product.stockByColorSize[activeColorSlug][size] = qty;
    });
  }

  function bindStockSection() {
    document.getElementById('save-stock-btn').addEventListener('click', () => {
      persistCurrentStockInputs();
      renderTable();
      const note = document.getElementById('stock-saved-note');
      note.style.display = 'inline';
      setTimeout(() => { note.style.display = 'none'; }, 2000);
    });
  }

  function closeEditModal() {
    persistCurrentStockInputs();
    closeModal();
  }

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px;">
          <img src="${product.image || ''}" alt="" class="table-thumb" style="width:56px;height:56px;" onerror="this.style.visibility='hidden'">
          <div>
            <h2 style="font-size:18px;margin-bottom:2px;">${escapeHtml(product.name)}</h2>
            <p style="color:var(--color-text-soft);font-size:12.5px;">${escapeHtml(product.sku)} · ${escapeHtml(product.categoryLabel || product.category)}</p>
          </div>
        </div>

        ${!product.official ? '' : `<p style="font-size:12px;color:var(--color-text-faint);margin-bottom:12px;">Este é um produto do catálogo oficial da loja. Alterações de preço, promoção e estoque feitas aqui afetam a vitrine, o PDV e o painel imediatamente. O cadastro em si (fotos, nome, novas cores) só pode ser alterado no código-fonte.</p>`}

        <div style="margin-top:6px;">
          <strong style="font-size:12.5px;">Variações — cores disponíveis (${(product.colors || []).length})</strong>
          <p style="font-size:11.5px;color:var(--color-text-faint);margin:4px 0 10px;">Clique em uma cor para ver e editar o estoque dela. Preço e promoção valem para todas as cores.</p>
          <div class="variation-grid" id="variation-grid">
            ${(product.colors || []).map((c) => {
              const img = product.colorImages?.[c.slug]?.[0];
              return `
              <div class="variation-chip ${c.slug === activeColorSlug ? 'active' : ''}" data-color-slug="${c.slug}" title="${escapeHtml(c.name)}">
                ${img
                  ? `<img src="${img}" alt="${escapeHtml(c.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
                  : ''}
                <span class="variation-chip-swatch" style="background:${c.hex};${img ? 'display:none;' : ''}"></span>
                <span class="variation-chip-label">${escapeHtml(c.name)}</span>
              </div>`;
            }).join('') || '<p style="font-size:12.5px;color:var(--color-text-faint);">Nenhuma cor cadastrada.</p>'}
          </div>
        </div>

        <form id="edit-price-form" class="admin-form" style="margin-top:18px;">
          <div class="form-row">
            <label>Preço normal (R$)<input type="number" step="0.01" min="0" name="price" value="${product.price}"></label>
            <label>Preço promocional (R$, opcional)<input type="number" step="0.01" min="0" name="promoPrice" value="${product.promoPrice ?? ''}" placeholder="Sem promoção"></label>
          </div>
          <p style="font-size:11.5px;color:var(--color-text-faint);">Se o preço promocional for preenchido e menor que o normal, ele passa a ser o preço realmente cobrado — o normal aparece riscado na loja e no PDV. ${product.official ? 'Se este campo ficar vazio e houver um desconto geral ativo (Configurações), o preço normal continua sendo o valor cobrado — só aparece um preço "de" riscado maior, de vitrine.' : ''}</p>
          <button type="submit" class="btn btn-outline btn-sm">Salvar preço</button>
        </form>

        <div style="margin-top:16px;" id="stock-section">${stockSectionHtml()}</div>

        <div style="margin-top:20px;border-top:1px solid var(--color-border);padding-top:16px;">
          ${product.official
            ? `<button type="button" class="btn btn-outline btn-block" id="hide-product-btn" style="color:#B3261E;border-color:#B3261E;">${icon('trash', 'icon icon-sm')} Ocultar do painel</button>
               <p style="font-size:11.5px;color:var(--color-text-faint);margin-top:6px;">Isso só esconde o produto da listagem do painel administrativo — o produto continua disponível na loja normalmente, pois faz parte do catálogo oficial.</p>`
            : `<button type="button" class="btn btn-outline btn-block" id="delete-mock-btn" style="color:#B3261E;border-color:#B3261E;">${icon('trash', 'icon icon-sm')} Excluir produto de demonstração</button>`}
        </div>
      </div>
    </div>`;

  bindStockSection();

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal(); });
  document.getElementById('modal-close').addEventListener('click', closeEditModal);

  document.querySelectorAll('#variation-grid [data-color-slug]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const newSlug = chip.getAttribute('data-color-slug');
      if (newSlug === activeColorSlug) return;
      persistCurrentStockInputs();
      activeColorSlug = newSlug;
      document.querySelectorAll('#variation-grid [data-color-slug]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('stock-section').innerHTML = stockSectionHtml();
      bindStockSection();
    });
  });

  document.getElementById('edit-price-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const price = Number(data.get('price'));
    if (!Number.isFinite(price) || price < 0) return;
    updateProductPrice(product.id, price);
    const promoRaw = data.get('promoPrice');
    updateProductPromoPrice(product.id, promoRaw ? Number(promoRaw) : null);
    renderTable();
    closeEditModal();
  });

  document.getElementById('hide-product-btn')?.addEventListener('click', () => {
    if (!confirm('Ocultar este produto do painel administrativo? Ele continuará disponível na loja.')) return;
    hideOfficialProduct(product.id);
    renderTable();
    closeEditModal();
  });

  document.getElementById('delete-mock-btn')?.addEventListener('click', () => {
    if (!confirm('Excluir este produto de demonstração?')) return;
    deleteMockProduct(product.id);
    renderTable();
    closeEditModal();
  });
}

function openNewProductModal() {
  const root = document.getElementById('product-modal-root');
  const categoryOptions = Object.keys(PRODUCT_COSTS);

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <h2 style="font-size:19px;margin-bottom:6px;">Novo produto (demonstração)</h2>
        <p style="font-size:12px;color:var(--color-text-faint);margin-bottom:16px;">Produtos criados aqui servem para testes do painel e não aparecem na loja pública.</p>
        <form id="new-product-form" class="admin-form">
          <label>Nome<input type="text" name="name" required></label>
          <div class="form-row">
            <label>Categoria
              <select name="category">
                ${categoryOptions.map((c) => `<option value="${c}">${c[0].toUpperCase()}${c.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label>Preço (R$)<input type="number" step="0.01" min="0" name="price" required></label>
          </div>
          <div class="form-row">
            <label>Custo (R$)<input type="number" step="0.01" min="0" name="cost"></label>
            <label>Estoque inicial (por tamanho)<input type="number" min="0" name="stock" value="10"></label>
          </div>
          <label>URL da imagem (opcional)<input type="text" name="image" placeholder="/public/products/..."></label>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px;">Criar produto</button>
        </form>
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('new-product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.name?.trim()) return;
    data.categoryLabel = data.category[0].toUpperCase() + data.category.slice(1);
    if (!data.cost) data.cost = PRODUCT_COSTS[data.category] || 0;
    addMockProduct(data);
    closeModal();
    renderTable();
  });
}

function closeModal() {
  document.getElementById('product-modal-root').innerHTML = '';
}

export async function afterRender() {
  renderTable();

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderTable();
  });
  document.getElementById('category-filter').addEventListener('change', (e) => {
    state.category = e.target.value;
    renderTable();
  });
  document.getElementById('new-product-btn').addEventListener('click', openNewProductModal);
}
