import { getItems, getSubtotal, updateQty, removeItem, getCoupon, applyCoupon, removeCoupon } from '../context/cartStore.js';
import { applyCouponToTotal } from '../services/couponService.js';
import { formatBRL } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { navigate } from '../router.js';

let isOpen = false;

export function openCartDrawer() {
  isOpen = true;
  renderDrawer();
}

export function closeCartDrawer() {
  isOpen = false;
  document.getElementById('cart-drawer-root').innerHTML = '';
}

export function isCartDrawerOpen() {
  return isOpen;
}

export function renderDrawer() {
  if (!isOpen) return;
  const root = document.getElementById('cart-drawer-root');
  const items = getItems();
  const subtotal = getSubtotal();
  const coupon = getCoupon();
  const { discount } = applyCouponToTotal(coupon, subtotal, 0);
  const total = Math.max(subtotal - discount, 0);

  root.innerHTML = `
    <div class="drawer-overlay" data-drawer-overlay></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrinho de compras">
      <div class="drawer-head">
        <h3>Seu carrinho ${items.length ? `(${items.reduce((s, i) => s + i.qty, 0)})` : ''}</h3>
        <button class="btn-icon" data-drawer-close aria-label="Fechar carrinho">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        ${items.length ? items.map(lineItem).join('') : emptyCart()}
      </div>
      ${items.length ? `
      <div class="drawer-foot">
        <div class="coupon-row">
          <input type="text" id="drawer-coupon-input" placeholder="Cupom de desconto" value="${coupon ? escapeHtml(coupon.code) : ''}" ${coupon ? 'disabled' : ''} />
          ${coupon ? `<button class="btn btn-outline btn-sm" data-remove-coupon>Remover</button>` : `<button class="btn btn-outline btn-sm" data-apply-coupon>Aplicar</button>`}
        </div>
        <div id="drawer-coupon-feedback"></div>
        <div class="summary-row"><span>Subtotal</span><span>${formatBRL(subtotal)}</span></div>
        ${discount > 0 ? `<div class="summary-row"><span>Desconto (${coupon.code})</span><span class="value discount">- ${formatBRL(discount)}</span></div>` : ''}
        <div class="summary-row"><span>Frete</span><span>Calculado no checkout</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatBRL(total)}</span></div>
        <button class="btn btn-primary btn-block" data-go-checkout style="margin-top:14px;">Finalizar compra ${icon('arrowRight', 'icon icon-sm')}</button>
        <button class="btn btn-outline btn-block" data-go-cart style="margin-top:10px;">Ver carrinho completo</button>
      </div>` : ''}
    </aside>`;

  bindDrawerEvents();
}

function emptyCart() {
  return `
    <div class="page-empty" style="padding:60px 10px;">
      <div class="icon-circle">${icon('bag', 'icon')}</div>
      <h2 style="font-size:18px;">Seu carrinho está vazio</h2>
      <p style="font-size:13.5px;">Explore nossos moletons e blusas e encontre a peça perfeita para você.</p>
      <a href="#/produtos" class="btn btn-primary" data-drawer-close>Ver produtos</a>
    </div>`;
}

function lineItem(item) {
  return `
    <div class="cart-line" data-line="${item.id}|${item.size}|${item.color}">
      <div class="cart-line-img"><img src="${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.opacity=0"></div>
      <div class="cart-line-info">
        <div class="cart-line-name">${escapeHtml(item.name)}</div>
        <div class="cart-line-meta">Tam: ${item.size} &middot; Cor: ${escapeHtml(item.color)}</div>
        <div class="cart-line-bottom">
          <div class="cart-qty">
            <button data-qty-minus aria-label="Diminuir quantidade">${icon('minus', 'icon icon-sm')}</button>
            <span>${item.qty}</span>
            <button data-qty-plus aria-label="Aumentar quantidade">${icon('plus', 'icon icon-sm')}</button>
          </div>
          <strong>${formatBRL(item.price * item.qty)}</strong>
        </div>
      </div>
      <button class="cart-line-remove" data-remove aria-label="Remover item">${icon('trash', 'icon icon-sm')}</button>
    </div>`;
}

function bindDrawerEvents() {
  const root = document.getElementById('cart-drawer-root');
  root.querySelector('[data-drawer-overlay]')?.addEventListener('click', closeCartDrawer);
  root.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', closeCartDrawer));

  root.querySelectorAll('[data-line]').forEach((line) => {
    const [id, size, color] = line.dataset.line.split('|');
    const item = getItems().find((i) => i.id === id && i.size === size && i.color === color);
    line.querySelector('[data-qty-minus]')?.addEventListener('click', () => {
      updateQty(id, size, color, (item.qty || 1) - 1);
    });
    line.querySelector('[data-qty-plus]')?.addEventListener('click', () => {
      updateQty(id, size, color, (item.qty || 1) + 1);
    });
    line.querySelector('[data-remove]')?.addEventListener('click', () => {
      removeItem(id, size, color);
      showToast('Item removido do carrinho', 'info');
    });
  });

  root.querySelector('[data-apply-coupon]')?.addEventListener('click', () => {
    const input = root.querySelector('#drawer-coupon-input');
    const result = applyCoupon(input.value);
    const feedback = root.querySelector('#drawer-coupon-feedback');
    if (result.ok) {
      feedback.innerHTML = `<div class="coupon-feedback success">${icon('checkCircle', 'icon icon-sm')} Cupom aplicado: ${escapeHtml(result.coupon.label)}</div>`;
      showToast('Cupom aplicado com sucesso!', 'success');
    } else {
      feedback.innerHTML = `<div class="coupon-feedback error">${icon('x', 'icon icon-sm')} ${escapeHtml(result.message)}</div>`;
    }
  });

  root.querySelector('[data-remove-coupon]')?.addEventListener('click', () => {
    removeCoupon();
    showToast('Cupom removido', 'info');
  });

  root.querySelector('[data-go-checkout]')?.addEventListener('click', () => {
    closeCartDrawer();
    navigate('/checkout');
  });
  root.querySelector('[data-go-cart]')?.addEventListener('click', () => {
    closeCartDrawer();
    navigate('/carrinho');
  });
}

window.addEventListener('cart:change', renderDrawer);
