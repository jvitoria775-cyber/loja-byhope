import { formatBRL, formatDate } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';

const PAYMENT_LABELS = {
  infinitepay: 'InfinitePay',
  credit_card: 'Cartão de Crédito (InfinitePay)',
  pix: 'Pix (InfinitePay)',
};

let currentOrder = null;

export async function render(params, query = {}) {
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

  // A InfinitePay retorna alguns parametros na URL apos o pagamento
  // (transaction_nsu, capture_method, receipt_url, slug). Eles podem vir
  // como query string normal OU anexados dentro do proprio hash da rota -
  // por isso verificamos as duas origens antes de exibir/gravar a confirmacao.
  const searchParams = new URLSearchParams(location.search);
  const captureMethod = query.capture_method || searchParams.get('capture_method');
  const transactionNsu = query.transaction_nsu || searchParams.get('transaction_nsu');
  const receiptUrl = query.receipt_url || searchParams.get('receipt_url');

  if (captureMethod || transactionNsu) {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm-payment', captureMethod, transactionNsu, receiptUrl }),
      });
      if (res.ok) ({ order } = await res.json());
      currentOrder = order;
    } catch { /* mantém os dados já carregados se a confirmação falhar */ }
  }

  const eta = order.shipping?.days ? `${order.shipping.days} dias úteis` : 'a confirmar';
  const paymentLabel = PAYMENT_LABELS[order.payment.method] || order.payment.method;
  const isPaid = order.payment.status === 'pago';

  return `
  <div class="success-page">
    <div class="success-icon">${icon('check')}</div>
    <h1>Pedido realizado com sucesso!</h1>
    <p class="section-sub" style="margin:10px auto 0;">Obrigado por comprar na GRATITUDE TÊXTIL. Enviamos os detalhes para ${escapeHtml(order.customer.email)}.</p>

    <div class="order-card">
      <div class="order-card-row"><span>Número do pedido</span><strong>#${order.id}</strong></div>
      <div class="order-card-row"><span>Data</span><span>${formatDate(order.date)}</span></div>
      <div class="order-card-row"><span>Itens</span><span>${order.items.reduce((s, i) => s + i.qty, 0)} peça(s)</span></div>
      <div class="order-card-row"><span>Forma de pagamento</span><span>${escapeHtml(paymentLabel)}</span></div>
      <div class="order-card-row"><span>Status do pagamento</span><span style="color:${isPaid ? 'var(--color-success)' : 'var(--color-text-soft)'};font-weight:600;">${isPaid ? 'Pago' : 'Aguardando confirmação'}</span></div>
      <div class="order-card-row"><span>Endereço de entrega</span><span style="text-align:right;">${escapeHtml(order.address.street)}, ${escapeHtml(order.address.number)} — ${escapeHtml(order.address.city)}/${escapeHtml(order.address.state)}</span></div>
      <div class="order-card-row"><span>Previsão de entrega</span><span>${eta}</span></div>
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
}
