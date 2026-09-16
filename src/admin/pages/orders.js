import { getAllOrders, updateFulfillmentStatus, updateTrackingCode, FULFILLMENT_STEPS } from '../orderStore.js';
import { formatBRL, formatDate } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

const PAGE_SIZE = 10;
const PAYMENT_LABELS = { infinitepay: 'InfinitePay', dinheiro: 'Dinheiro', cartao: 'Cartão (maquininha)', credit_card: 'Cartão', pix: 'Pix' };

const QUICK_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'pago', label: 'Pagos' },
  { key: 'em separação', label: 'Em separação' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'cancelado', label: 'Cancelados' },
];

let state = { search: '', quickFilter: '', channel: '', page: 1 };
let allOrders = [];

export async function render() {
  allOrders = getAllOrders();
  return `
    <div class="panel">
      <div class="quick-filter-tabs" id="quick-filter-tabs">
        ${QUICK_FILTERS.map((f) => `<button type="button" data-filter="${f.key}" class="${state.quickFilter === f.key ? 'active' : ''}">${f.label}</button>`).join('')}
      </div>
      <div class="table-toolbar">
        <input type="search" id="search-input" placeholder="Buscar por número, nome ou e-mail..." value="${escapeHtml(state.search)}" />
        <select id="channel-filter">
          <option value="">Todos os canais</option>
          <option value="online" ${state.channel === 'online' ? 'selected' : ''}>Loja online</option>
          <option value="pdv" ${state.channel === 'pdv' ? 'selected' : ''}>PDV (balcão)</option>
        </select>
      </div>
      <div id="orders-table-wrap"></div>
      <div id="pagination-wrap"></div>
    </div>
    <div id="order-modal-root"></div>
  `;
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (state.quickFilter && o.fulfillmentStatus !== state.quickFilter) return false;
    if (state.channel && o.channel !== state.channel) return false;
    if (state.search) {
      const haystack = `${o.id} ${o.customer?.firstName || ''} ${o.customer?.lastName || ''} ${o.customer?.email || ''}`.toLowerCase();
      if (!haystack.includes(state.search.toLowerCase())) return false;
    }
    return true;
  });
}

function renderTable() {
  const wrap = document.getElementById('orders-table-wrap');
  const filtered = getFilteredOrders();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-note"><strong>Nenhum pedido encontrado.</strong><span>Ajuste os filtros ou o termo de busca.</span></div>`;
    document.getElementById('pagination-wrap').innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr><th>Pedido</th><th>Cliente</th><th>Data/Hora</th><th>Itens</th><th>Total</th><th>Pagamento</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${pageItems.map((o) => `
          <tr data-order-id="${o.id}">
            <td><strong>#${o.id}</strong><br><span class="badge-pill badge-${o.channel}" style="margin-top:4px;">${o.channel === 'pdv' ? 'PDV' : 'Online'}</span></td>
            <td>${escapeHtml(`${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || '—')}</td>
            <td>${formatDate(o.date)}</td>
            <td>${(o.items || []).reduce((s, i) => s + i.qty, 0)} peça(s)</td>
            <td>${formatBRL(o.total)}</td>
            <td>${escapeHtml(PAYMENT_LABELS[o.payment?.method] || o.payment?.method || '—')}</td>
            <td>${statusBadge(o.fulfillmentStatus)}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-view="${o.id}">Detalhes</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openOrderModal(btn.getAttribute('data-view')); });
  });
  wrap.querySelectorAll('tr[data-order-id]').forEach((row) => {
    row.addEventListener('click', () => openOrderModal(row.getAttribute('data-order-id')));
  });

  renderPagination(totalPages, filtered.length);
}

function renderPagination(totalPages, total) {
  const el = document.getElementById('pagination-wrap');
  if (totalPages <= 1) { el.innerHTML = `<p style="color:var(--color-text-faint);font-size:12px;margin-top:10px;">${total} pedido(s)</p>`; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  el.innerHTML = `
    <div class="pagination-row">
      <span style="color:var(--color-text-faint);font-size:12px;">${total} pedido(s) · página ${state.page} de ${totalPages}</span>
      <div class="pagination-btns">
        <button type="button" class="btn-icon-plain" data-page="prev" ${state.page === 1 ? 'disabled' : ''}>${icon('chevronLeft', 'icon icon-sm')}</button>
        ${pages.map((p) => `<button type="button" class="page-num ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button type="button" class="btn-icon-plain" data-page="next" ${state.page === totalPages ? 'disabled' : ''}>${icon('chevronRight', 'icon icon-sm')}</button>
      </div>
    </div>`;

  el.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-page');
      if (val === 'prev') state.page = Math.max(1, state.page - 1);
      else if (val === 'next') state.page = Math.min(totalPages, state.page + 1);
      else state.page = Number(val);
      renderTable();
    });
  });
}

function statusBadge(status) {
  const map = {
    pago: ['badge-pago', 'Pago'], enviado: ['badge-pago', 'Enviado'], 'em separação': ['badge-pendente', 'Em separação'],
    pendente: ['badge-pendente', 'Pendente'], cancelado: ['badge-cancelado', 'Cancelado'],
  };
  const [cls, label] = map[status] || ['badge-pendente', status || 'Pendente'];
  return `<span class="badge-pill ${cls}">${label}</span>`;
}

function openOrderModal(id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;
  const root = document.getElementById('order-modal-root');

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <h2 style="font-size:19px;margin-bottom:4px;">Pedido #${order.id}</h2>
        <p style="color:var(--color-text-soft);font-size:12.5px;margin-bottom:16px;">${formatDate(order.date)} · ${order.channel === 'pdv' ? 'Venda no balcão (PDV)' : 'Loja online'}</p>

        <div class="detail-row"><span>Cliente</span><span>${escapeHtml(`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || '—')}</span></div>
        ${order.customer?.email ? `<div class="detail-row"><span>E-mail</span><span>${escapeHtml(order.customer.email)}</span></div>` : ''}
        ${order.customer?.phone ? `<div class="detail-row"><span>Telefone</span><span>${escapeHtml(order.customer.phone)}</span></div>` : ''}
        ${order.address ? `<div class="detail-row"><span>Endereço de entrega</span><span>${escapeHtml(order.address.street || '')}, ${escapeHtml(order.address.number || '')} — ${escapeHtml(order.address.city || '')}/${escapeHtml(order.address.state || '')}</span></div>` : `<div class="detail-row"><span>Entrega</span><span>Retirada no balcão</span></div>`}
        <div class="detail-row"><span>Pagamento</span><span>${escapeHtml(PAYMENT_LABELS[order.payment?.method] || order.payment?.method || '—')}</span></div>

        <div class="detail-items">
          ${(order.items || []).map((i) => `
            <div class="detail-item-line">
              <img src="${i.image || ''}" alt="" onerror="this.style.visibility='hidden'">
              <div style="flex:1;">
                <strong>${escapeHtml(i.name)}</strong>
                <span style="color:var(--color-text-soft);">Tam ${i.size} · ${escapeHtml(i.color)} · Qtd ${i.qty} · ${formatBRL(i.price * i.qty)}</span>
              </div>
            </div>`).join('')}
        </div>

        <div class="detail-row"><span>Subtotal</span><span>${formatBRL(order.subtotal)}</span></div>
        ${order.discount ? `<div class="detail-row"><span>Desconto</span><span>- ${formatBRL(order.discount)}</span></div>` : ''}
        <div class="detail-row"><span>Frete</span><span>${order.shippingPrice ? formatBRL(order.shippingPrice) : 'Grátis / retirada'}</span></div>
        <div class="detail-row"><span><strong>Total</strong></span><span><strong>${formatBRL(order.total)}</strong></span></div>

        <div style="margin-top:16px;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Código de rastreio</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="tracking-input" value="${escapeHtml(order.trackingCode || '')}" placeholder="Ex: BR123456789BR" style="flex:1;padding:9px 12px;border:1px solid var(--color-border);border-radius:6px;font-size:13px;" />
            <button type="button" class="btn btn-outline btn-sm" id="save-tracking-btn">Salvar</button>
          </div>
        </div>

        <div style="margin-top:18px;">
          <strong style="font-size:12.5px;">Status do pedido</strong>
          <div class="status-actions">
            ${FULFILLMENT_STEPS.map((s) => `<button type="button" class="btn btn-sm ${order.fulfillmentStatus === s.value ? 'btn-primary' : 'btn-outline'}" data-set-status="${s.value}">${s.label}</button>`).join('')}
          </div>
        </div>

        <div style="margin-top:18px;">
          <strong style="font-size:12.5px;">Histórico</strong>
          <div class="history-timeline">
            ${[...(order.statusHistory || [])].reverse().map((h) => `
              <div class="history-row">
                <span class="history-dot"></span>
                <div><strong>${escapeHtml(FULFILLMENT_STEPS.find((s) => s.value === h.status)?.label || h.status)}</strong><span>${formatDate(h.date)}</span></div>
              </div>`).join('')}
          </div>
        </div>

        <button type="button" class="btn btn-outline btn-block" id="export-receipt-btn" style="margin-top:18px;">${icon('printer', 'icon icon-sm')} Exportar comprovante</button>
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);

  root.querySelectorAll('[data-set-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateFulfillmentStatus(order.id, btn.getAttribute('data-set-status'));
      allOrders = getAllOrders();
      renderTable();
      openOrderModal(order.id);
    });
  });

  document.getElementById('save-tracking-btn').addEventListener('click', () => {
    const val = document.getElementById('tracking-input').value.trim();
    updateTrackingCode(order.id, val);
    allOrders = getAllOrders();
  });

  document.getElementById('export-receipt-btn').addEventListener('click', () => exportReceipt(order));
}

function closeModal() {
  document.getElementById('order-modal-root').innerHTML = '';
}

// "Exportar comprovante" abre uma janela com um recibo formatado para
// impressão - o cliente/loja pode usar "Salvar como PDF" do navegador.
// Não usamos nenhuma biblioteca de geração de PDF (o projeto não tem
// dependências externas), então esta é a forma real e funcional de gerar
// um comprovante imprimível sem backend.
function exportReceipt(order) {
  const win = window.open('', '_blank');
  if (!win) return;
  const itemsHtml = (order.items || []).map((i) => `
    <tr><td>${escapeHtml(i.name)} (${i.size}/${escapeHtml(i.color)})</td><td>${i.qty}</td><td>${formatBRL(i.price)}</td><td>${formatBRL(i.price * i.qty)}</td></tr>`).join('');

  win.document.write(`
    <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante #${order.id}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#1A1A1A;}
      h1{font-size:20px;margin-bottom:4px;} p{margin:2px 0;font-size:13px;color:#555;}
      table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;font-size:13px;}
      .total{font-size:16px;font-weight:bold;text-align:right;margin-top:14px;}
    </style></head><body>
    <h1>Gratitude Têxtil — Comprovante de Pedido #${order.id}</h1>
    <p>Data: ${formatDate(order.date)}</p>
    <p>Cliente: ${escapeHtml(`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim())}</p>
    <p>Pagamento: ${escapeHtml(PAYMENT_LABELS[order.payment?.method] || order.payment?.method || '—')} · Status: ${escapeHtml(order.fulfillmentStatus)}</p>
    <table><thead><tr><th>Item</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table>
    <p class="total">Total: ${formatBRL(order.total)}</p>
    <script>window.onload = () => window.print();</script>
    </body></html>`);
  win.document.close();
}

export async function afterRender() {
  renderTable();

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.getElementById('channel-filter').addEventListener('change', (e) => {
    state.channel = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.querySelectorAll('#quick-filter-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.quickFilter = btn.getAttribute('data-filter');
      state.page = 1;
      document.querySelectorAll('#quick-filter-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTable();
    });
  });
}
