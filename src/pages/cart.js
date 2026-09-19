import { getItems, getSubtotal, getCount, updateQty, removeItem, getCoupon, applyCoupon, removeCoupon } from '../context/cartStore.js';
import { applyCouponToTotal } from '../services/couponService.js';
import { calculateShipping, isValidCep } from '../services/shippingService.js';
import { formatBRL } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getItem, setItem } from '../utils/storage.js';
import { getCurrentUser, WHOLESALE_MIN_QTY } from '../context/authStore.js';

let chosenShipping = getItem('shippingChoice', null);

export function render() {
  const items = getItems();

  if (!items.length) {
    return `
    <div class="container">
      <div class="page-empty">
        <div class="icon-circle">${icon('bag', 'icon')}</div>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione peças que combinam com você e volte aqui para finalizar sua compra.</p>
        <a href="#/produtos" class="btn btn-primary">Explorar produtos</a>
      </div>
    </div>`;
  }

  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs"><a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')} <span>Carrinho</span></div>
      <h1>Meu Carrinho</h1>
    </div>
  </div>
  <div class="container">
    <div class="checkout-layout">
      <div>
        <div id="cart-lines">${items.map(lineRow).join('')}</div>

        <div class="checkout-section" style="margin-top:24px;">
          <h3>${icon('truck', 'icon icon-sm')} Simular frete</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <input type="text" id="cep-input" placeholder="Digite seu CEP (ex: 01310-100)" maxlength="9" style="flex:1;min-width:200px;padding:12px 14px;border:1px solid var(--color-border);border-radius:var(--radius-sm);" />
            <button class="btn btn-outline" id="calc-shipping-btn">Calcular</button>
          </div>
          <div id="shipping-results" style="margin-top:16px;"></div>
        </div>
      </div>

      <aside class="order-summary-card" id="order-summary">
        ${summaryHtml()}
      </aside>
    </div>
  </div>`;
}

function lineRow(item) {
  return `
    <div class="cart-line" style="background:#fff;border:1px solid var(--color-border-soft);border-radius:var(--radius-md);padding:16px;margin-bottom:14px;" data-line="${item.id}|${item.size}|${item.color}">
      <div class="cart-line-img" style="width:96px;height:118px;"><img src="${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.opacity=0"></div>
      <div class="cart-line-info">
        <div class="cart-line-name" style="font-size:15px;">${escapeHtml(item.name)}</div>
        <div class="cart-line-meta">Tamanho: ${item.size} &middot; Cor: ${escapeHtml(item.color)}</div>
        <div class="cart-line-bottom">
          <div class="cart-qty">
            <button data-qty-minus aria-label="Diminuir quantidade">${icon('minus', 'icon icon-sm')}</button>
            <span>${item.qty}</span>
            <button data-qty-plus aria-label="Aumentar quantidade">${icon('plus', 'icon icon-sm')}</button>
          </div>
          <strong style="font-size:16px;">${formatBRL(item.price * item.qty)}</strong>
        </div>
      </div>
      <button class="cart-line-remove" data-remove aria-label="Remover item">${icon('trash')}</button>
    </div>`;
}

function summaryHtml() {
  const subtotal = getSubtotal();
  const coupon = getCoupon();
  const shippingPrice = chosenShipping ? chosenShipping.price : 0;
  const { discount, shippingDiscount } = applyCouponToTotal(coupon, subtotal, shippingPrice);
  const finalShipping = Math.max(shippingPrice - shippingDiscount, 0);
  const total = Math.max(subtotal - discount + finalShipping, 0);
  const missingQty = getCurrentUser() ? Math.max(WHOLESALE_MIN_QTY - getCount(), 0) : 0;

  return `
    <h3>Resumo do pedido</h3>
    <div class="coupon-row">
      <input type="text" id="coupon-input" placeholder="Cupom de desconto" value="${coupon ? escapeHtml(coupon.code) : ''}" ${coupon ? 'disabled' : ''} />
      ${coupon ? `<button class="btn btn-outline btn-sm" id="remove-coupon-btn">Remover</button>` : `<button class="btn btn-outline btn-sm" id="apply-coupon-btn">Aplicar</button>`}
    </div>
    <div id="coupon-feedback"></div>
    <p class="form-hint" style="margin:-6px 0 14px;">Experimente: BEMVINDO10, MODA10, PRIMEIRACOMPRA ou FRETEGRATIS</p>

    <div class="summary-row"><span>Subtotal</span><span>${formatBRL(subtotal)}</span></div>
    ${discount > 0 ? `<div class="summary-row"><span>Desconto (${coupon.code})</span><span class="value discount">- ${formatBRL(discount)}</span></div>` : ''}
    <div class="summary-row"><span>Frete${chosenShipping ? ` (${chosenShipping.label})` : ''}</span><span>${chosenShipping ? (finalShipping === 0 ? 'Grátis' : formatBRL(finalShipping)) : 'A calcular'}</span></div>
    <div class="summary-row total"><span>Total</span><span>${formatBRL(total)}</span></div>

    ${missingQty > 0 ? `<p class="form-hint" style="color:var(--color-error);margin-top:10px;">Faltam ${missingQty} peça${missingQty > 1 ? 's' : ''} para atingir o pedido mínimo do atacado (${WHOLESALE_MIN_QTY} peças).</p>` : ''}
    <button class="btn btn-primary btn-block" id="cart-checkout-btn" style="margin-top:16px;" ${missingQty > 0 ? 'disabled' : ''}>Ir para o checkout ${icon('arrowRight', 'icon icon-sm')}</button>
    <a href="#/produtos" class="btn btn-outline btn-block" style="margin-top:10px;">Continuar comprando</a>
  `;
}

function refreshSummary() {
  const el = document.getElementById('order-summary');
  if (el) el.innerHTML = summaryHtml();
  bindSummaryEvents();
}

function bindLineEvents() {
  document.querySelectorAll('[data-line]').forEach((line) => {
    const [id, size, color] = line.dataset.line.split('|');
    line.querySelector('[data-qty-minus]')?.addEventListener('click', () => {
      const item = getItems().find((i) => i.id === id && i.size === size && i.color === color);
      updateQty(id, size, color, (item?.qty || 1) - 1);
    });
    line.querySelector('[data-qty-plus]')?.addEventListener('click', () => {
      const item = getItems().find((i) => i.id === id && i.size === size && i.color === color);
      updateQty(id, size, color, (item?.qty || 1) + 1);
    });
    line.querySelector('[data-remove]')?.addEventListener('click', () => {
      removeItem(id, size, color);
      showToast('Item removido do carrinho', 'info');
    });
  });
}

function bindSummaryEvents() {
  document.getElementById('apply-coupon-btn')?.addEventListener('click', () => {
    const input = document.getElementById('coupon-input');
    const result = applyCoupon(input.value);
    const feedback = document.getElementById('coupon-feedback');
    if (result.ok) {
      feedback.innerHTML = `<div class="coupon-feedback success">${icon('checkCircle', 'icon icon-sm')} ${escapeHtml(result.coupon.label)}</div>`;
      showToast('Cupom aplicado com sucesso!', 'success');
    } else {
      feedback.innerHTML = `<div class="coupon-feedback error">${icon('x', 'icon icon-sm')} ${escapeHtml(result.message)}</div>`;
    }
  });
  document.getElementById('remove-coupon-btn')?.addEventListener('click', () => {
    removeCoupon();
    showToast('Cupom removido', 'info');
  });
  document.getElementById('cart-checkout-btn')?.addEventListener('click', () => {
    import('../router.js').then(({ navigate }) => navigate('/checkout'));
  });
}

export function afterRender() {
  document.title = 'Meu Carrinho | GRATITUDE TÊXTIL';
  if (!getItems().length) return;

  bindLineEvents();
  bindSummaryEvents();

  document.getElementById('calc-shipping-btn')?.addEventListener('click', calcShipping);
  document.getElementById('cep-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') calcShipping();
  });

  window.addEventListener('cart:change', onCartChange);
}

function onCartChange() {
  if (location.hash.replace('#', '').split('?')[0] !== '/carrinho') {
    window.removeEventListener('cart:change', onCartChange);
    return;
  }
  const app = document.getElementById('app');
  app.innerHTML = render();
  afterRender();
}

async function calcShipping() {
  const input = document.getElementById('cep-input');
  const resultsEl = document.getElementById('shipping-results');
  if (!isValidCep(input.value)) {
    resultsEl.innerHTML = `<div class="coupon-feedback error">${icon('x', 'icon icon-sm')} CEP inválido. Digite um CEP no formato 00000-000.</div>`;
    return;
  }

  resultsEl.innerHTML = `<p class="form-hint">Calculando frete...</p>`;

  let result;
  try {
    result = await calculateShipping(input.value, getItems());
  } catch (err) {
    resultsEl.innerHTML = `<div class="coupon-feedback error">${icon('x', 'icon icon-sm')} ${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!result.options.length) {
    resultsEl.innerHTML = `<div class="coupon-feedback error">${icon('x', 'icon icon-sm')} ${escapeHtml(result.error || 'Nenhuma opção de frete disponível para este CEP.')}</div>`;
    return;
  }

  resultsEl.innerHTML = result.options.map((opt) => `
      <label class="shipping-option ${chosenShipping?.type === opt.type ? 'active' : ''}" data-shipping-option="${opt.type}">
        <span class="shipping-option-left">
          <input type="radio" name="shipping-opt" ${chosenShipping?.type === opt.type ? 'checked' : ''} />
          <span>
            <span class="shipping-option-name">${opt.label}</span>
            <span class="shipping-option-days" style="display:block;">Chega em até ${opt.days} dias úteis</span>
          </span>
        </span>
        <span class="shipping-option-price">${formatBRL(opt.price)}</span>
      </label>`).join('');

  resultsEl.querySelectorAll('[data-shipping-option]').forEach((el) => {
    el.addEventListener('click', () => {
      const type = el.getAttribute('data-shipping-option');
      const opt = result.options.find((o) => o.type === type);
      chosenShipping = opt;
      setItem('shippingChoice', opt);
      resultsEl.querySelectorAll('[data-shipping-option]').forEach((o) => {
        o.classList.remove('active');
        o.querySelector('input').checked = false;
      });
      el.classList.add('active');
      el.querySelector('input').checked = true;
      refreshSummary();
      showToast(`Frete ${opt.label} selecionado`, 'success', 2000);
    });
  });
}
