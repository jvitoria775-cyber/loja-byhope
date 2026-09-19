import { formatBRL, formatDate } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';

const PAYMENT_LABELS = {
  mercadopago: 'Mercado Pago',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  pix: 'Pix',
};

let currentOrder = null;
let pollTimer = null;

export async function render(params) {
  const id = params[0];
  let order = null;
  try {
    const res = await fetch(`/api/orders/${id}`);
    if (res.ok) ({ order } = await res.json());
  } catch { /* rede indisponível - trata como não encontrado abaixo */ }
  currentOrder = order;

  if (!order) {
    return `
    <div class="empty-state">
      <div class="icon-circle">${icon('package', 'icon')}</div>
      <h3>Pedido não encontrado.</h3>
      <p>Não encontramos os detalhes deste pedido.</p>
      <a href="#/" class="btn btn-outline">Voltar ao início</a>
    </div>`;
  }

  return renderOrderHtml(order);
}

function renderOrderHtml(order) {
  const isPickup = order.shipping?.type === 'retirada';
  const eta = isPickup ? 'Disponível para retirada assim que o pagamento for confirmado' : (order.shipping?.days ? `${order.shipping.days} dias úteis` : 'a confirmar');
  const paymentLabel = PAYMENT_LABELS[order.payment.method] || order.payment.method;
  const isPaid = order.payment.status === 'pago';
  const awaitingPix = !isPaid && order.payment.pixQrCode;

  return `
  <div class="success-page">
    ${awaitingPix ? `
      <div class="pix-wait-block" id="pix-wait-block">
        <h1 style="margin-bottom:6px;">Falta só o pagamento!</h1>
        <p class="section-sub" style="margin:0 auto 20px;">Escaneie o QR code ou use o Pix Copia e Cola. A confirmação é automática — essa página atualiza sozinha assim que o pagamento cair.</p>
        ${order.payment.pixQrCodeBase64 ? `<img src="data:image/png;base64,${escapeHtml(order.payment.pixQrCodeBase64)}" alt="QR code Pix" style="width:220px;height:220px;margin:0 auto 18px;display:block;border:1px solid var(--color-border-soft);border-radius:var(--radius-md);">` : ''}
        <div class="pix-copy-row">
          <input type="text" id="pix-copy-input" readonly value="${escapeHtml(order.payment.pixQrCode || '')}">
          <button type="button" class="btn btn-primary" id="pix-copy-btn">Copiar código</button>
        </div>
        ${order.payment.pixTicketUrl ? `<p class="form-hint" style="margin-top:10px;"><a href="${escapeHtml(order.payment.pixTicketUrl)}" target="_blank" rel="noopener noreferrer">Ou abra o link de pagamento</a></p>` : ''}
        <p class="form-hint" style="margin-top:14px;">Aguardando pagamento — não feche esta página.</p>
      </div>` : `
      <div class="success-icon">${icon('check')}</div>
      <h1>Pedido realizado com sucesso!</h1>
      <p class="section-sub" style="margin:10px auto 0;">Obrigado por comprar na GRATITUDE TÊXTIL. Enviamos os detalhes para ${escapeHtml(order.customer.email)}.</p>`}

    <div class="order-card">
      <div class="order-card-row"><span>Número do pedido</span><strong>#${order.id}</strong></div>
      <div class="order-card-row"><span>Data</span><span>${formatDate(order.date)}</span></div>
      <div class="order-card-row"><span>Itens</span><span>${order.items.reduce((s, i) => s + i.qty, 0)} peça(s)</span></div>
      <div class="order-card-row"><span>Forma de pagamento</span><span>${escapeHtml(paymentLabel)}</span></div>
      <div class="order-card-row"><span>Status do pagamento</span><span style="color:${isPaid ? 'var(--color-success)' : 'var(--color-text-soft)'};font-weight:600;">${isPaid ? 'Pago' : 'Aguardando confirmação'}</span></div>
      <div class="order-card-row"><span>${isPickup ? 'Entrega' : 'Endereço de entrega'}</span><span style="text-align:right;">${isPickup ? 'Retirada na loja' : `${escapeHtml(order.address.street)}, ${escapeHtml(order.address.number)} — ${escapeHtml(order.address.city)}/${escapeHtml(order.address.state)}`}</span></div>
      <div class="order-card-row"><span>${isPickup ? 'Disponibilidade' : 'Previsão de entrega'}</span><span>${eta}</span></div>
      <div class="order-card-row"><span>Subtotal</span><span>${formatBRL(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="order-card-row"><span>Desconto</span><span>- ${formatBRL(order.discount)}</span></div>` : ''}
      <div class="order-card-row"><span>Frete</span><span>${order.shippingPrice === 0 ? 'Grátis' : formatBRL(order.shippingPrice)}</span></div>
      <div class="order-card-row"><span><strong>Total</strong></span><span><strong>${formatBRL(order.total)}</strong></span></div>
    </div>

    ${order.payment.receiptUrl ? `<a href="${escapeHtml(order.payment.receiptUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="margin-right:12px;">Ver comprovante</a>` : ''}
    <a href="#/produtos" class="btn btn-primary">Continuar comprando</a>
  </div>`;
}

export function afterRender() {
  document.title = 'Pedido confirmado | GRATITUDE TÊXTIL';
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  document.getElementById('pix-copy-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('pix-copy-input');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
  });

  if (!currentOrder || currentOrder.payment.status === 'pago' || !currentOrder.payment.pixQrCode) return;

  const orderId = currentOrder.id;
  pollTimer = setInterval(async () => {
    // Se a página não é mais esta (usuário navegou pra outro lugar),
    // para de checar - não tem mais nada pra atualizar aqui.
    if (!document.getElementById('pix-wait-block')) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) return;
      const { order } = await res.json();
      if (order.payment.status === 'pago') {
        clearInterval(pollTimer);
        pollTimer = null;
        currentOrder = order;
        document.getElementById('app').innerHTML = renderOrderHtml(order);
        afterRender();
      }
    } catch { /* tenta de novo na próxima vez */ }
  }, 5000);
}
