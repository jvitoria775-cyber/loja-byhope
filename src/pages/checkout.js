import { getItems, getSubtotal, getCoupon, clearCart } from '../context/cartStore.js';
import { applyCouponToTotal } from '../services/couponService.js';
import { simulateShipping, isValidCep } from '../services/shippingService.js';
import { createInfinitePayLink } from '../services/paymentService.js';
import { formatBRL } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getCurrentUser, getToken } from '../context/authStore.js';
import { setItem, getItem } from '../utils/storage.js';

let shippingOptions = [];
let selectedShipping = getItem('shippingChoice', null);

export function render() {
  const items = getItems();

  if (!items.length) {
    return `
    <div class="container">
      <div class="page-empty">
        <div class="icon-circle">${icon('bag', 'icon')}</div>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione produtos ao carrinho antes de finalizar a compra.</p>
        <a href="#/produtos" class="btn btn-primary">Explorar produtos</a>
      </div>
    </div>`;
  }

  const user = getCurrentUser();

  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs"><a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')} <a href="#/carrinho">Carrinho</a> ${icon('chevronRight', 'icon icon-sm')} <span>Checkout</span></div>
      <h1>Finalizar Compra</h1>
    </div>
  </div>

  <div class="container">
    <div class="checkout-steps">
      <div class="checkout-step active" data-step-indicator="1">1. Seus dados</div>
      <div class="checkout-step" data-step-indicator="2">2. Entrega</div>
      <div class="checkout-step" data-step-indicator="3">3. Pagamento</div>
    </div>

    <form id="checkout-form">
      <div class="checkout-layout">
        <div>
          <div class="checkout-section">
            <h3><span class="step-num">1</span> Dados pessoais</h3>
            <div class="form-grid">
              ${field('firstName', 'Nome', 'text', user?.fullName?.split(' ')[0] || '')}
              ${field('lastName', 'Sobrenome', 'text', user?.fullName?.split(' ').slice(1).join(' ') || '')}
              ${field('email', 'E-mail', 'email', user?.email || '', 'full')}
              ${field('phone', 'Telefone / WhatsApp', 'tel', user?.phone || '', 'full', '(11) 91234-5678')}
            </div>
          </div>

          <div class="checkout-section">
            <h3><span class="step-num">2</span> Endereço de entrega</h3>
            <div class="form-grid">
              ${field('cep', 'CEP', 'text', user?.address?.cep || '', '', '00000-000')}
              ${field('street', 'Rua', 'text', user?.address?.street || '', '', '')}
              ${field('number', 'Número', 'text', user?.address?.number || '', '', '')}
              ${field('complement', 'Complemento (opcional)', 'text', user?.address?.complement || '', '', 'Apto, bloco...', false)}
              ${field('neighborhood', 'Bairro', 'text', user?.address?.neighborhood || '', '', '')}
              ${field('city', 'Cidade', 'text', user?.address?.city || '', '', '')}
              ${stateField(user?.address?.state)}
            </div>
          </div>

          <div class="checkout-section">
            <h3><span class="step-num">3</span> Método de entrega</h3>
            <div id="checkout-shipping-options">
              <p class="form-hint">Informe o CEP acima para ver as opções de frete disponíveis.</p>
            </div>
          </div>

          <div class="checkout-section">
            <h3><span class="step-num">4</span> Forma de pagamento</h3>
            <div class="infinitepay-note">
              <div class="infinitepay-note-icon">${icon('shield')}</div>
              <div>
                <strong>Pagamento seguro via InfinitePay</strong>
                <p>Ao confirmar, você será direcionado para a página segura da InfinitePay para escolher entre <strong>Pix</strong> ou <strong>Cartão de crédito (em até 12x)</strong> e concluir o pagamento. Seus dados de cartão são digitados diretamente lá — nunca passam pelo nosso site.</p>
              </div>
            </div>
          </div>
        </div>

        <aside class="order-summary-card">
          <h3>Resumo do pedido</h3>
          ${items.map((i) => `
            <div class="summary-line-item">
              <img src="${i.image}" alt="${escapeHtml(i.name)}" onerror="this.style.opacity=0">
              <div class="info"><strong>${escapeHtml(i.name)}</strong>Tam ${i.size} &middot; ${escapeHtml(i.color)} &middot; Qtd ${i.qty}<br>${formatBRL(i.price * i.qty)}</div>
            </div>`).join('')}
          <div id="checkout-totals">${renderTotals()}</div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:16px;">Confirmar pedido</button>
        </aside>
      </div>
    </form>
  </div>`;
}

function field(name, label, type, value = '', extraClass = '', placeholder = '', required = true) {
  return `
    <div class="form-field ${extraClass}" data-field="${name}">
      <label for="f-${name}">${label}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} />
      <span class="error-msg">Este campo é obrigatório.</span>
    </div>`;
}

function stateField(selected = '') {
  const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  return `
    <div class="form-field" data-field="state">
      <label for="f-state">Estado</label>
      <select id="f-state" name="state" required>
        <option value="">Selecione</option>
        ${states.map((s) => `<option value="${s}" ${selected === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <span class="error-msg">Selecione um estado.</span>
    </div>`;
}

function renderTotals() {
  const subtotal = getSubtotal();
  const coupon = getCoupon();
  const shippingPrice = selectedShipping ? selectedShipping.price : 0;
  const { discount, shippingDiscount } = applyCouponToTotal(coupon, subtotal, shippingPrice);
  const finalShipping = Math.max(shippingPrice - shippingDiscount, 0);
  const total = Math.max(subtotal - discount + finalShipping, 0);
  return `
    <div class="summary-row"><span>Subtotal</span><span>${formatBRL(subtotal)}</span></div>
    ${discount > 0 ? `<div class="summary-row"><span>Cupom (${coupon.code})</span><span class="value discount">- ${formatBRL(discount)}</span></div>` : ''}
    <div class="summary-row"><span>Frete</span><span>${selectedShipping ? (finalShipping === 0 ? 'Grátis' : formatBRL(finalShipping)) : 'Informe o CEP'}</span></div>
    <div class="summary-row total"><span>Total</span><span>${formatBRL(total)}</span></div>`;
}

export function afterRender() {
  document.title = 'Checkout | GRATITUDE TÊXTIL';
  if (!getItems().length) return;

  const cepInput = document.getElementById('f-cep');
  cepInput?.addEventListener('blur', () => {
    if (!isValidCep(cepInput.value)) return;
    const result = simulateShipping(cepInput.value);
    shippingOptions = result.options;
    const el = document.getElementById('checkout-shipping-options');
    el.innerHTML = result.options.map((opt) => `
      <label class="shipping-option" data-ship="${opt.type}">
        <span class="shipping-option-left">
          <input type="radio" name="shipping" ${selectedShipping?.type === opt.type ? 'checked' : ''} required />
          <span><span class="shipping-option-name">${opt.label}</span><span class="shipping-option-days" style="display:block;">Chega em até ${opt.days} dias úteis</span></span>
        </span>
        <span class="shipping-option-price">${formatBRL(opt.price)}</span>
      </label>`).join('');

    el.querySelectorAll('[data-ship]').forEach((label) => {
      label.addEventListener('click', () => {
        const type = label.getAttribute('data-ship');
        selectedShipping = shippingOptions.find((o) => o.type === type);
        setItem('shippingChoice', selectedShipping);
        el.querySelectorAll('[data-ship]').forEach((l) => { l.classList.remove('active'); l.querySelector('input').checked = false; });
        label.classList.add('active');
        label.querySelector('input').checked = true;
        document.getElementById('checkout-totals').innerHTML = renderTotals();
      });
    });

    if (selectedShipping && shippingOptions.some((o) => o.type === selectedShipping.type)) {
      el.querySelector(`[data-ship="${selectedShipping.type}"]`)?.classList.add('active');
      document.getElementById('checkout-totals').innerHTML = renderTotals();
    }
  });

  const form = document.getElementById('checkout-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) {
      showToast('Verifique os campos destacados no formulário.', 'error');
      return;
    }
    if (!selectedShipping) {
      showToast('Selecione uma opção de frete para continuar.', 'error');
      document.getElementById('f-cep').focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const order = buildOrder(data);

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gerando pagamento seguro...';

    try {
      const token = getToken();
      const orderHeaders = { 'Content-Type': 'application/json' };
      if (token) orderHeaders.Authorization = `Bearer ${token}`;
      const createRes = await fetch('/api/orders', {
        method: 'POST',
        headers: orderHeaders,
        body: JSON.stringify(order),
      });
      if (!createRes.ok) throw new Error('Não foi possível registrar o pedido. Tente novamente.');

      const totalPeças = order.items.reduce((s, i) => s + i.qty, 0);
      const items = [{
        quantity: 1,
        price: Math.round(order.total * 100),
        description: `Pedido ${order.id} — Gratitude Têxtil (${totalPeças} peça${totalPeças > 1 ? 's' : ''})`,
      }];
      const redirectUrl = `${location.origin}${location.pathname}#/pedido/${order.id}`;
      const paymentUrl = await createInfinitePayLink({
        items,
        orderNsu: order.id,
        redirectUrl,
        customer: {
          name: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email,
          phone_number: data.phone,
        },
      });
      clearCart();
      window.location.href = paymentUrl;
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      showToast(err.message || 'Não foi possível iniciar o pagamento. Tente novamente.', 'error');
    }
  });
}

function validateForm(form) {
  let valid = true;
  form.querySelectorAll('.form-field').forEach((field) => {
    const input = field.querySelector('input, select');
    if (!input) return;
    if (input.hasAttribute('required') && !input.value.trim()) {
      field.classList.add('invalid');
      valid = false;
    } else {
      field.classList.remove('invalid');
    }
  });
  return valid;
}

function buildOrder(data) {
  const items = getItems();
  const subtotal = getSubtotal();
  const coupon = getCoupon();
  const shippingPrice = selectedShipping ? selectedShipping.price : 0;
  const { discount, shippingDiscount } = applyCouponToTotal(coupon, subtotal, shippingPrice);
  const finalShipping = Math.max(shippingPrice - shippingDiscount, 0);
  const total = Math.max(subtotal - discount + finalShipping, 0);

  const id = `GT${Date.now().toString().slice(-8)}`;

  return {
    id,
    date: new Date().toISOString(),
    items,
    customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone },
    address: { cep: data.cep, street: data.street, number: data.number, complement: data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state },
    shipping: selectedShipping,
    payment: { method: 'infinitepay', status: 'aguardando confirmação' },
    coupon,
    subtotal, discount, shippingDiscount, shippingPrice: finalShipping, total,
  };
}
