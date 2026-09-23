import { getItems, getSubtotal, getCount, getCoupon, clearCart } from '../context/cartStore.js';
import { applyCouponToTotal } from '../services/couponService.js';
import { calculateShipping, isValidCep } from '../services/shippingService.js';
import { lookupCep } from '../services/cepService.js';
import { createOrder, createPixCharge, loadMercadoPago } from '../services/paymentService.js';
import { formatBRL } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { getCurrentUser, getToken, isWholesale, WHOLESALE_MIN_QTY } from '../context/authStore.js';
import { setItem, getItem } from '../utils/storage.js';
import { isValidCpf, isValidCnpj, formatCpf, formatCnpj, onlyDigits } from '../utils/validators.js';
import { navigate } from '../router.js';

const RETIRADA_SHIPPING = { type: 'retirada', label: 'Retirada na loja', price: 0, days: 0 };

let shippingOptions = [];
let selectedShipping = getItem('shippingChoice', null);
// Guarda o pedido já criado no banco, pra não criar um segundo pedido
// duplicado se o cliente tentar de novo depois de uma falha ao carregar o
// Payment Brick (o pedido em si já foi salvo com sucesso nesse caso).
let createdOrder = null;

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
  const wholesale = isWholesale();

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
              ${field('cpf', 'CPF', 'text', user?.docNumber ? (user.docType === 'cnpj' ? formatCnpj(user.docNumber) : formatCpf(user.docNumber)) : '', 'full', '000.000.000-00', true, 'Informe um CPF válido.')}
            </div>
            <p class="form-hint">O CPF é exigido pelos Correios para a emissão da etiqueta de envio.</p>
          </div>

          <div class="checkout-section" id="address-section">
            <h3><span class="step-num">2</span> Endereço de entrega</h3>
            ${wholesale ? `<p class="form-hint" id="address-optional-note" style="display:none;">Não é necessário preencher o endereço para retirada na loja.</p>` : ''}
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
            ${wholesale ? `
              <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                <label class="shipping-option ${selectedShipping?.type === 'retirada' ? 'active' : ''}" data-delivery-toggle="retirada" style="flex:1;min-width:200px;">
                  <span class="shipping-option-left">
                    <input type="radio" name="delivery-method" value="retirada" ${selectedShipping?.type === 'retirada' ? 'checked' : ''} />
                    <span><span class="shipping-option-name">Retirar na loja</span><span class="shipping-option-days" style="display:block;">Sem custo de frete</span></span>
                  </span>
                  <span class="shipping-option-price">Grátis</span>
                </label>
                <label class="shipping-option ${selectedShipping?.type !== 'retirada' ? 'active' : ''}" data-delivery-toggle="envio" style="flex:1;min-width:200px;">
                  <span class="shipping-option-left">
                    <input type="radio" name="delivery-method" value="envio" ${selectedShipping?.type !== 'retirada' ? 'checked' : ''} />
                    <span><span class="shipping-option-name">Receber em casa</span><span class="shipping-option-days" style="display:block;">Calculado pelo CEP</span></span>
                  </span>
                </label>
              </div>
            ` : ''}
            <div id="checkout-shipping-options">
              <p class="form-hint">Informe o CEP acima para ver as opções de frete disponíveis.</p>
            </div>
          </div>

          <div class="checkout-section">
            <h3><span class="step-num">4</span> Forma de pagamento</h3>
            <div class="infinitepay-note">
              <div class="infinitepay-note-icon">${icon('shield')}</div>
              <div>
                ${wholesale ? `
                  <strong>Pagamento via Pix</strong>
                  <p>Ao confirmar, vamos gerar um <strong>QR code Pix</strong> na própria tela do pedido — é só escanear ou usar o código copia e cola no app do seu banco. A confirmação é automática assim que o pagamento cai.</p>
                ` : `
                  <strong>Pagamento seguro com Mercado Pago</strong>
                  <p>Escolha entre <strong>Pix</strong> ou <strong>cartão de crédito/débito</strong> sem sair do nosso site — é só clicar em "Ir para pagamento" abaixo. Seus dados de cartão são protegidos diretamente pelo Mercado Pago.</p>
                `}
              </div>
            </div>
            ${!wholesale ? `<div id="mp-brick-container" style="margin-top:16px;"></div>` : ''}
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
          ${wholesale && getCount() < WHOLESALE_MIN_QTY ? `<p class="form-hint" style="color:var(--color-error);">Faltam ${WHOLESALE_MIN_QTY - getCount()} peça${WHOLESALE_MIN_QTY - getCount() > 1 ? 's' : ''} para atingir o pedido mínimo do atacado (${WHOLESALE_MIN_QTY} peças). <a href="#/produtos">Voltar aos produtos</a>.</p>` : ''}
          <button type="submit" id="checkout-submit-btn" class="btn btn-primary btn-block" style="margin-top:16px;" ${wholesale && getCount() < WHOLESALE_MIN_QTY ? 'disabled' : ''}>${wholesale ? 'Confirmar pedido' : 'Ir para pagamento'}</button>
        </aside>
      </div>
    </form>
  </div>`;
}

function field(name, label, type, value = '', extraClass = '', placeholder = '', required = true, errorMsg = 'Este campo é obrigatório.') {
  return `
    <div class="form-field ${extraClass}" data-field="${name}">
      <label for="f-${name}">${label}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} />
      <span class="error-msg">${escapeHtml(errorMsg)}</span>
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

const ADDRESS_FIELD_NAMES = ['cep', 'street', 'number', 'neighborhood', 'city', 'state'];

function setAddressRequired(required) {
  ADDRESS_FIELD_NAMES.forEach((name) => {
    const input = document.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.toggleAttribute('required', required);
    input.disabled = !required;
    input.closest('.form-field')?.classList.remove('invalid');
  });
  const note = document.getElementById('address-optional-note');
  if (note) note.style.display = required ? 'none' : '';
  const section = document.getElementById('address-section');
  if (section) section.style.opacity = required ? '' : '0.55';
}

// Preenche rua/bairro/cidade/estado sozinho a partir do CEP (ViaCEP) -
// só sobra número e complemento pro cliente digitar. Falha em silêncio
// (CEP não encontrado, serviço fora do ar) - os campos continuam vazios
// e editáveis normalmente nesse caso.
async function fillAddressFromCep(cep) {
  const address = await lookupCep(cep);
  if (!address) return;
  const streetInput = document.querySelector('[name="street"]');
  const neighborhoodInput = document.querySelector('[name="neighborhood"]');
  const cityInput = document.querySelector('[name="city"]');
  const stateSelect = document.querySelector('[name="state"]');
  if (streetInput) streetInput.value = address.street;
  if (neighborhoodInput) neighborhoodInput.value = address.neighborhood;
  if (cityInput) cityInput.value = address.city;
  if (stateSelect && address.state) stateSelect.value = address.state;
  [streetInput, neighborhoodInput, cityInput, stateSelect].forEach((input) => {
    input?.closest('.form-field')?.classList.remove('invalid');
  });
  document.getElementById('f-number')?.focus();
}

function applyDeliveryMethod(mode) {
  const shippingEl = document.getElementById('checkout-shipping-options');
  document.querySelectorAll('[data-delivery-toggle]').forEach((label) => {
    const isActive = label.getAttribute('data-delivery-toggle') === mode;
    label.classList.toggle('active', isActive);
    label.querySelector('input').checked = isActive;
  });

  if (mode === 'retirada') {
    selectedShipping = RETIRADA_SHIPPING;
    setItem('shippingChoice', selectedShipping);
    setAddressRequired(false);
    shippingEl.innerHTML = `<div class="coupon-feedback success">${icon('checkCircle', 'icon icon-sm')} Retirada na loja selecionada — sem custo de frete.</div>`;
  } else {
    selectedShipping = null;
    setItem('shippingChoice', null);
    setAddressRequired(true);
    shippingEl.innerHTML = `<p class="form-hint">Informe o CEP acima para ver as opções de frete disponíveis.</p>`;
  }
  document.getElementById('checkout-totals').innerHTML = renderTotals();
}

export function afterRender() {
  document.title = 'Checkout | GRATITUDE TÊXTIL';
  if (!getItems().length) return;
  createdOrder = null;

  document.querySelectorAll('[data-delivery-toggle]').forEach((label) => {
    label.addEventListener('click', () => applyDeliveryMethod(label.getAttribute('data-delivery-toggle')));
  });
  if (isWholesale() && selectedShipping?.type === 'retirada') {
    setAddressRequired(false);
  }

  const cpfInput = document.getElementById('f-cpf');
  cpfInput?.addEventListener('input', () => {
    cpfInput.value = onlyDigits(cpfInput.value).length > 11 ? formatCnpj(cpfInput.value) : formatCpf(cpfInput.value);
  });

  const cepInput = document.getElementById('f-cep');
  cepInput?.addEventListener('blur', async () => {
    if (cepInput.disabled || !isValidCep(cepInput.value)) return;
    fillAddressFromCep(cepInput.value);
    const el = document.getElementById('checkout-shipping-options');
    el.innerHTML = `<p class="form-hint">Calculando frete...</p>`;

    let result;
    try {
      result = await calculateShipping(cepInput.value, getItems());
    } catch (err) {
      el.innerHTML = `<p class="form-hint" style="color:var(--color-error);">${escapeHtml(err.message)}</p>`;
      return;
    }

    shippingOptions = result.options;
    if (!shippingOptions.length) {
      el.innerHTML = `<p class="form-hint" style="color:var(--color-error);">${escapeHtml(result.error || 'Nenhuma opção de frete disponível para este CEP.')}</p>`;
      return;
    }

    el.innerHTML = shippingOptions.map((opt) => `
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
    const cpfRaw = document.getElementById('f-cpf').value;
    const cpfDigits = onlyDigits(cpfRaw);
    const docOk = cpfDigits.length > 11 ? isValidCnpj(cpfDigits) : isValidCpf(cpfDigits);
    if (!docOk) {
      document.querySelector('[data-field="cpf"]').classList.add('invalid');
      showToast('Informe um CPF válido — os Correios exigem esse dado para emitir a etiqueta de envio.', 'error');
      document.getElementById('f-cpf').focus();
      return;
    }
    if (!selectedShipping) {
      showToast('Selecione uma opção de frete para continuar.', 'error');
      document.getElementById('f-cep').focus();
      return;
    }
    if (isWholesale() && getCount() < WHOLESALE_MIN_QTY) {
      showToast(`O pedido mínimo do atacado é ${WHOLESALE_MIN_QTY} peças.`, 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gerando pagamento seguro...';

    try {
      if (!createdOrder) {
        const data = Object.fromEntries(new FormData(form).entries());
        const order = buildOrder(data);
        const token = getToken();
        const orderHeaders = { 'Content-Type': 'application/json' };
        if (token) orderHeaders.Authorization = `Bearer ${token}`;
        const createRes = await fetch('/api/orders', {
          method: 'POST',
          headers: orderHeaders,
          body: JSON.stringify(order),
        });
        if (!createRes.ok) throw new Error('Não foi possível registrar o pedido. Tente novamente.');
        createdOrder = order;
      }

      if (isWholesale()) {
        // Cliente atacadista: cobrança Pix direta, sem sair do site - a
        // própria página do pedido mostra o QR code e fica aguardando a
        // confirmação automática (webhook).
        await createPixCharge({ orderId: createdOrder.id });
        clearCart();
        navigate(`/pedido/${createdOrder.id}`);
        return;
      }

      // Varejo: esconde o botão principal e mostra o Payment Brick
      // embutido (cartão ou Pix, o cliente escolhe dentro do próprio
      // widget) - o botão de pagar de verdade passa a ser o do Brick.
      submitBtn.style.display = 'none';
      await mountPaymentBrick(createdOrder);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      showToast(err.message || 'Não foi possível iniciar o pagamento. Tente novamente.', 'error');
    }
  });
}

async function mountPaymentBrick(order) {
  const container = document.getElementById('mp-brick-container');
  container.innerHTML = `<p class="form-hint">Carregando formas de pagamento...</p>`;

  try {
    const mp = await loadMercadoPago();
    container.innerHTML = '';
    await mp.bricks().create('payment', 'mp-brick-container', {
      initialization: {
        amount: order.total,
        payer: { email: order.customer.email },
      },
      customization: {
        paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all' },
      },
      callbacks: {
        onReady: () => {},
        onError: (err) => {
          console.error('Payment Brick error:', err);
          showToast('Não foi possível carregar o formulário de pagamento. Atualize a página e tente de novo.', 'error');
        },
        onSubmit: ({ selectedPaymentMethod, formData }) => new Promise((resolve, reject) => {
          createOrder({ orderId: order.id, selectedPaymentMethod, formData })
            .then(() => {
              resolve();
              clearCart();
              navigate(`/pedido/${order.id}`);
            })
            .catch((err) => {
              showToast(err.message || 'Não foi possível processar o pagamento.', 'error');
              reject();
            });
        }),
      },
    });
  } catch (err) {
    container.innerHTML = `<p class="form-hint" style="color:var(--color-error);">${escapeHtml(err.message)}</p>`;
    document.getElementById('checkout-submit-btn').style.display = '';
    throw err;
  }
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
    customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, document: onlyDigits(data.cpf) },
    address: selectedShipping?.type === 'retirada' ? null : { cep: data.cep, street: data.street, number: data.number, complement: data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state },
    shipping: selectedShipping,
    payment: { method: 'mercadopago', status: 'aguardando confirmação' },
    coupon,
    subtotal, discount, shippingDiscount, shippingPrice: finalShipping, total,
  };
}
