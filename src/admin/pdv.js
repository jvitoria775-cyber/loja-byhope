import { isUnlocked, renderGate, lock } from './adminAuth.js';
import { getCatalogProducts } from '../services/catalogService.js';
import { saveOrder, generatePdvOrderId } from './orderStore.js';
import { createPixCharge } from '../services/paymentService.js';
import { apiGet } from './apiClient.js';
import { formatBRL } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';

let allProducts = [];
let CATEGORIES = [{ key: '', label: 'Todas' }];

let cart = []; // { productId, colorSlug, colorName, size, qty, price, name, image }
let activeCategory = '';
let searchTerm = '';
let paymentMethod = 'dinheiro';
let manualDiscount = 0;

// Venda presencial no PDV não tem cliente logado (é o funcionário quem
// atende no balcão) - por isso o preço de atacado aqui não depende de
// conta nenhuma, só desse interruptor manual. Enquanto ativo, todo produto
// adicionado à venda usa o preço de atacado (tabela 1) em vez do varejo;
// produtos sem preço de atacado cadastrado continuam no preço normal.
let wholesaleMode = false;

function effectivePrice(product) {
  return (wholesaleMode && product.wholesalePrice) ? product.wholesalePrice : product.price;
}

function init() {
  if (isUnlocked()) {
    boot();
  } else {
    renderGate(boot);
  }
}

// Carrega o catálogo (com estoque/preço já mesclados) uma única vez ao
// abrir o PDV - busca/filtro depois disso são instantâneos, sem bater na
// rede a cada tecla digitada.
async function boot() {
  // getCatalogProducts() é a mesma leitura pública usada pela loja, então
  // nunca vem com preço de atacado (isso é o correto para a loja - aqui no
  // PDV, autenticado como admin, buscamos os ajustes de novo com o token
  // do painel só para pegar o wholesaleTiers de cada produto.
  const [catalog, productsData] = await Promise.all([
    getCatalogProducts(),
    apiGet('/products'),
  ]);
  const overrides = productsData.overrides || {};
  allProducts = catalog.map((p) => ({
    ...p,
    wholesalePrice: Number(overrides[p.id]?.wholesaleTiers?.tier1) > 0 ? Number(overrides[p.id].wholesaleTiers.tier1) : null,
  }));
  CATEGORIES = [
    { key: '', label: 'Todas' },
    ...Array.from(allProducts.reduce((m, p) => m.set(p.category, p.categoryLabel), new Map()), ([value, label]) => ({ key: value, label })),
  ];
  render();
}

function render() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="pdv-topbar">
      <div class="logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" onerror="this.style.display='none'"></div>
      <nav>
        <button type="button" id="wholesale-mode-btn" class="pdv-wholesale-btn ${wholesaleMode ? 'active' : ''}">${icon('store', 'icon icon-sm')} Modo atacado</button>
        <a href="/admin.html">${icon('package', 'icon icon-sm')} Pedidos</a>
        <a href="/" target="_blank" rel="noopener noreferrer">Ver loja</a>
        <button type="button" id="lock-btn">${icon('lock', 'icon icon-sm')} Sair</button>
      </nav>
    </div>
    <div class="pdv-wholesale-banner" id="pdv-wholesale-banner" ${wholesaleMode ? '' : 'hidden'}>${icon('store', 'icon icon-sm')} Modo atacado ativo — os produtos adicionados agora usam o preço de atacado (tabela 1). Itens já na venda mantêm o preço com que foram adicionados.</div>
    <div class="pdv-shell ${wholesaleMode ? 'has-banner' : ''}" id="pdv-shell">
      <section class="pdv-catalog">
        <div class="pdv-catalog-header">
          <h1 style="font-size:20px;">Venda no balcão</h1>
          <input type="search" class="pdv-search" id="pdv-search" placeholder="Buscar produto..." />
        </div>
        <div class="pdv-cat-tabs" id="pdv-cat-tabs">
          ${CATEGORIES.map((c) => `<button type="button" data-cat="${c.key}" class="${c.key === activeCategory ? 'active' : ''}">${escapeHtml(c.label)}</button>`).join('')}
        </div>
        <div class="pdv-product-grid" id="pdv-product-grid"></div>
      </section>

      <aside class="pdv-cart">
        <div class="pdv-cart-head">
          <strong>Venda atual</strong>
          <div style="margin-top:10px;">
            <input type="text" id="pdv-customer-name" placeholder="Nome do cliente (opcional)" style="width:100%;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;font-size:12.5px;margin-bottom:6px;" />
            <input type="text" id="pdv-customer-phone" placeholder="Telefone (opcional)" style="width:100%;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;font-size:12.5px;" />
          </div>
        </div>
        <div class="pdv-cart-body" id="pdv-cart-body"></div>
        <div class="pdv-cart-foot" id="pdv-cart-foot"></div>
      </aside>
    </div>
    <div id="pdv-modal-root"></div>
  `;

  document.getElementById('lock-btn').addEventListener('click', () => { lock(); location.reload(); });
  document.getElementById('wholesale-mode-btn').addEventListener('click', toggleWholesaleMode);
  document.getElementById('pdv-search').addEventListener('input', (e) => { searchTerm = e.target.value.toLowerCase(); renderProductGrid(); });
  document.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-cat');
      document.querySelectorAll('[data-cat]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderProductGrid();
    });
  });

  renderProductGrid();
  renderCart();
}

// Atualiza só o botão/faixa do modo atacado e os preços exibidos, sem
// reconstruir a página inteira - um render() completo apagaria o nome/
// telefone do cliente que o funcionário já tenha digitado no meio de uma
// venda.
function toggleWholesaleMode() {
  wholesaleMode = !wholesaleMode;
  document.getElementById('wholesale-mode-btn').classList.toggle('active', wholesaleMode);
  document.getElementById('pdv-wholesale-banner').hidden = !wholesaleMode;
  document.getElementById('pdv-shell').classList.toggle('has-banner', wholesaleMode);
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('pdv-product-grid');
  const list = allProducts.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  if (!list.length) {
    grid.innerHTML = `<p style="color:var(--color-text-soft);padding:20px;">Nenhum produto encontrado.</p>`;
    return;
  }

  grid.innerHTML = list.map((p) => {
    const price = effectivePrice(p);
    const showingWholesale = wholesaleMode && p.wholesalePrice;
    return `
    <div class="pdv-product-card" data-product-id="${p.id}">
      <div class="media"><img src="${p.images[0].src}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.opacity=0"></div>
      <div class="info">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${formatBRL(price)}${showingWholesale ? ` <s style="color:var(--color-text-faint);">${formatBRL(p.price)}</s>` : (p.oldPrice ? ` <s style="color:var(--color-text-faint);">${formatBRL(p.oldPrice)}</s>` : '')} · ${p.colors.length} cor(es)</span>
        ${wholesaleMode ? (p.wholesalePrice ? `<span class="pdv-wholesale-tag">atacado</span>` : `<span class="pdv-wholesale-tag off">sem atacado</span>`) : ''}
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-product-id]').forEach((card) => {
    card.addEventListener('click', () => openVariantModal(card.getAttribute('data-product-id')));
  });
}

function openVariantModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  let selectedColor = product.colors[0];
  let selectedSize = null;
  let qty = 1;

  const root = document.getElementById('pdv-modal-root');

  function paint() {
    const images = product.colorImages[selectedColor.slug] || product.images.map((i) => i.src);
    const price = effectivePrice(product);
    const showingWholesale = wholesaleMode && product.wholesalePrice;
    root.innerHTML = `
      <div class="modal-overlay" id="pdv-modal-overlay">
        <div class="modal-box">
          <button class="modal-close" id="pdv-modal-close">${icon('x')}</button>
          ${showingWholesale ? `<span class="pdv-wholesale-tag" style="margin-bottom:10px;">${icon('store', 'icon icon-sm')} preço de atacado</span>` : ''}
          <div style="display:flex;gap:16px;margin-bottom:16px;">
            <img src="${images[0]}" alt="${escapeHtml(product.name)}" style="width:100px;height:124px;object-fit:cover;border-radius:8px;" onerror="this.style.visibility='hidden'">
            <div>
              <h2 style="font-size:17px;">${escapeHtml(product.name)}</h2>
              <p style="color:var(--color-text-soft);font-size:13px;margin-top:4px;">${formatBRL(price)}${showingWholesale ? ` <s style="color:var(--color-text-faint);">${formatBRL(product.price)}</s>` : (product.oldPrice ? ` <s style="color:var(--color-text-faint);">${formatBRL(product.oldPrice)}</s>` : '')}</p>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <strong style="font-size:12.5px;">Cor: ${escapeHtml(selectedColor.name)}</strong>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              ${product.colors.map((c) => `
                <button type="button" data-color="${c.slug}" title="${escapeHtml(c.name)}" style="width:28px;height:28px;border-radius:50%;background:${c.hex};border:2px solid ${c.slug === selectedColor.slug ? 'var(--color-primary)' : 'transparent'};box-shadow:0 0 0 1px var(--color-border);cursor:pointer;"></button>`).join('')}
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <strong style="font-size:12.5px;">Tamanho</strong>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              ${product.sizes.map((s) => {
                const stock = product.stockByColorSize?.[selectedColor.slug]?.[s] ?? 0;
                const active = selectedSize === s;
                return `<button type="button" data-size="${s}" ${stock <= 0 ? 'disabled' : ''} style="min-width:44px;padding:8px 6px;border-radius:6px;border:1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'};background:${active ? 'var(--color-primary)' : '#fff'};color:${active ? '#fff' : 'var(--color-text)'};opacity:${stock <= 0 ? 0.4 : 1};">${s}</button>`;
              }).join('')}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
            <strong style="font-size:12.5px;">Quantidade</strong>
            <div class="pdv-qty" style="height:34px;">
              <button type="button" id="pdv-qty-minus" style="width:30px;">${icon('minus', 'icon icon-sm')}</button>
              <span style="min-width:26px;text-align:center;">${qty}</span>
              <button type="button" id="pdv-qty-plus" style="width:30px;">${icon('plus', 'icon icon-sm')}</button>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-block" id="pdv-add-btn">Adicionar à venda</button>
        </div>
      </div>`;

    const overlay = document.getElementById('pdv-modal-overlay');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.getElementById('pdv-modal-close').addEventListener('click', closeModal);

    root.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedColor = product.colors.find((c) => c.slug === btn.getAttribute('data-color'));
        paint();
      });
    });
    root.querySelectorAll('[data-size]').forEach((btn) => {
      if (btn.disabled) return;
      btn.addEventListener('click', () => { selectedSize = btn.getAttribute('data-size'); paint(); });
    });
    document.getElementById('pdv-qty-minus')?.addEventListener('click', () => { qty = Math.max(1, qty - 1); paint(); });
    document.getElementById('pdv-qty-plus')?.addEventListener('click', () => { qty += 1; paint(); });
    document.getElementById('pdv-add-btn')?.addEventListener('click', () => {
      if (!selectedSize) { showToast('Selecione um tamanho.', 'error'); return; }
      addToCart(product, selectedColor, selectedSize, qty, images[0]);
      closeModal();
    });
  }

  paint();
}

function closeModal() {
  document.getElementById('pdv-modal-root').innerHTML = '';
}

function addToCart(product, color, size, qty, image) {
  // O preço vai para o carrinho já resolvido (varejo ou atacado, conforme
  // o modo no momento do clique) e nunca mais muda depois disso - mesma
  // regra de "preço congelado" usada em todo o resto do sistema, para que
  // ligar/desligar o modo atacado no meio da venda não altere itens que já
  // estão na lista.
  const price = effectivePrice(product);
  const existing = cart.find((i) => i.productId === product.id && i.colorSlug === color.slug && i.size === size && i.price === price);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ productId: product.id, name: product.name, category: product.category, price, colorSlug: color.slug, colorName: color.name, size, qty, image });
  }
  renderCart();
  showToast(`${product.name} adicionado (${qty}x)`, 'success');
}

function renderCart() {
  const body = document.getElementById('pdv-cart-body');
  const foot = document.getElementById('pdv-cart-foot');

  if (!cart.length) {
    body.innerHTML = `<div class="pdv-empty-cart">${icon('bag', 'icon')}<p style="margin-top:8px;">Nenhum item na venda.<br>Clique em um produto para adicionar.</p></div>`;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = cart.map((item, idx) => `
    <div class="pdv-cart-line">
      <img src="${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.visibility='hidden'">
      <div class="info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>Tam ${item.size} · ${escapeHtml(item.colorName)}</span><br>
        <span>${formatBRL(item.price)} un.</span>
        <div class="pdv-qty">
          <button type="button" data-dec="${idx}">${icon('minus', 'icon icon-sm')}</button>
          <span>${item.qty}</span>
          <button type="button" data-inc="${idx}">${icon('plus', 'icon icon-sm')}</button>
          <button type="button" data-rm="${idx}" style="color:var(--color-error);">${icon('x', 'icon icon-sm')}</button>
        </div>
      </div>
      <strong style="font-size:12.5px;">${formatBRL(item.price * item.qty)}</strong>
    </div>`).join('');

  body.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => { cart[+b.dataset.inc].qty += 1; renderCart(); }));
  body.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.dec;
    cart[i].qty -= 1;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    renderCart();
  }));
  body.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { cart.splice(+b.dataset.rm, 1); renderCart(); }));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = Math.max(subtotal - manualDiscount, 0);

  foot.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <label style="font-size:12.5px;color:var(--color-text-soft);white-space:nowrap;">Desconto R$</label>
      <input type="number" id="pdv-discount" min="0" step="0.01" value="${manualDiscount || ''}" placeholder="0,00" style="flex:1;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;font-size:13px;" />
    </div>
    <div class="pdv-total-row"><span>Subtotal</span><span>${formatBRL(subtotal)}</span></div>
    ${manualDiscount > 0 ? `<div class="pdv-total-row"><span>Desconto</span><span>- ${formatBRL(manualDiscount)}</span></div>` : ''}
    <div class="pdv-total-row grand"><span>Total</span><span>${formatBRL(total)}</span></div>

    <div class="pdv-pay-tabs">
      <button type="button" data-pay="dinheiro" class="${paymentMethod === 'dinheiro' ? 'active' : ''}">Dinheiro</button>
      <button type="button" data-pay="cartao" class="${paymentMethod === 'cartao' ? 'active' : ''}">Cartão (maquininha)</button>
      <button type="button" data-pay="mercadopago" class="${paymentMethod === 'mercadopago' ? 'active' : ''}">Pix Mercado Pago</button>
    </div>

    <button type="button" class="btn btn-primary btn-block" id="pdv-finish-btn">Finalizar venda — ${formatBRL(total)}</button>
  `;

  document.getElementById('pdv-discount').addEventListener('input', (e) => {
    manualDiscount = Math.max(0, Number(e.target.value) || 0);
    renderCart();
  });
  foot.querySelectorAll('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', () => { paymentMethod = btn.getAttribute('data-pay'); renderCart(); });
  });
  document.getElementById('pdv-finish-btn').addEventListener('click', finishSale);
}

async function finishSale() {
  if (!cart.length) return;
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = Math.max(subtotal - manualDiscount, 0);
  const finishBtn = document.getElementById('pdv-finish-btn');

  const name = document.getElementById('pdv-customer-name').value.trim();
  const phone = document.getElementById('pdv-customer-phone').value.trim();

  const order = {
    id: generatePdvOrderId(),
    date: new Date().toISOString(),
    channel: 'pdv',
    customerType: wholesaleMode ? 'wholesale' : 'retail',
    items: cart.map((i) => ({ id: i.productId, name: i.name, category: i.category, price: i.price, image: i.image, size: i.size, color: i.colorName, qty: i.qty })),
    customer: { firstName: name || 'Cliente balcão', lastName: '', email: '', phone },
    address: null,
    shipping: { type: 'retirada', label: 'Venda no balcão', price: 0, days: 0 },
    payment: { method: paymentMethod, status: paymentMethod === 'mercadopago' ? 'aguardando confirmação' : 'pago' },
    coupon: null,
    subtotal, discount: manualDiscount, shippingDiscount: 0, shippingPrice: 0, total,
  };

  finishBtn.disabled = true;

  if (paymentMethod === 'mercadopago') {
    finishBtn.textContent = 'Gerando cobrança...';
    try {
      await saveOrder(order);
      const { qrCode, qrCodeBase64 } = await createPixCharge({ orderId: order.id });
      showPixReceipt(order, qrCode, qrCodeBase64);
    } catch (err) {
      finishBtn.disabled = false;
      finishBtn.textContent = `Finalizar venda — ${formatBRL(total)}`;
      showToast(err.message || 'Não foi possível gerar a cobrança.', 'error');
    }
    return;
  }

  try {
    await saveOrder(order);
    showSuccessReceipt(order);
  } catch (err) {
    finishBtn.disabled = false;
    finishBtn.textContent = `Finalizar venda — ${formatBRL(total)}`;
    showToast(err.message || 'Não foi possível registrar a venda. Tente novamente.', 'error');
  }
}

function showPixReceipt(order, qrCode, qrCodeBase64) {
  const root = document.getElementById('pdv-modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box" style="text-align:center;">
        <h2 style="font-size:18px;margin-bottom:10px;">Cobrança Pix gerada!</h2>
        <p style="color:var(--color-text-soft);font-size:13px;margin-bottom:16px;">Peça para o cliente escanear o QR code ou usar o Pix Copia e Cola.</p>
        ${qrCodeBase64 ? `<img src="data:image/png;base64,${escapeHtml(qrCodeBase64)}" alt="QR code Pix" style="width:200px;height:200px;margin:0 auto 16px;display:block;border:1px solid var(--color-border-soft);border-radius:var(--radius-md);">` : ''}
        <div class="pix-copy-row" style="margin-bottom:16px;">
          <input type="text" readonly value="${escapeHtml(qrCode || '')}" id="pdv-pix-copy-input" style="flex:1;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;font-size:12px;">
          <button type="button" class="btn btn-outline btn-sm" id="pdv-pix-copy-btn">Copiar</button>
        </div>
        <button type="button" class="btn btn-outline btn-block" id="pdv-new-sale">Nova venda</button>
      </div>
    </div>`;
  document.getElementById('pdv-pix-copy-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('pdv-pix-copy-input');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
  });
  document.getElementById('pdv-new-sale').addEventListener('click', resetSale);
}

function showSuccessReceipt(order) {
  const root = document.getElementById('pdv-modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box" style="text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--color-success-bg);color:var(--color-success);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">${icon('check', 'icon')}</div>
        <h2 style="font-size:18px;margin-bottom:6px;">Venda #${order.id} registrada!</h2>
        <p style="color:var(--color-text-soft);font-size:13px;margin-bottom:18px;">Total: <strong>${formatBRL(order.total)}</strong> · ${order.payment.method === 'dinheiro' ? 'Dinheiro' : 'Cartão (maquininha)'}</p>
        <button type="button" class="btn btn-primary btn-block" id="pdv-new-sale">Nova venda</button>
      </div>
    </div>`;
  document.getElementById('pdv-new-sale').addEventListener('click', resetSale);
}

function resetSale() {
  cart = [];
  manualDiscount = 0;
  paymentMethod = 'dinheiro';
  // Volta pro padrão seguro (varejo) a cada venda nova - assim o
  // funcionário precisa ativar de novo, de propósito, pro próximo cliente
  // atacadista, em vez de arriscar esquecer ligado e vender no atacado pro
  // cliente errado.
  if (wholesaleMode) toggleWholesaleMode();
  document.getElementById('pdv-modal-root').innerHTML = '';
  document.getElementById('pdv-customer-name').value = '';
  document.getElementById('pdv-customer-phone').value = '';
  renderCart();
}

function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.style.cssText = `background:${type === 'error' ? '#B3452C' : '#4C7A5E'};color:#fff;padding:12px 16px;border-radius:8px;font-size:13px;margin-top:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

init();
