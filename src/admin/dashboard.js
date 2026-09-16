import { isUnlocked, renderGate } from './adminAuth.js';
import { renderShell, bindShellEvents } from './shell.js';
import { getAllOrders, updateOrderStatus, computeStats } from './orderStore.js';
import { formatBRL, formatDate } from '../utils/format.js';
import { escapeHtml } from '../utils/dom.js';
import { icon } from '../components/icons.js';

let allOrders = [];
let filters = { search: '', status: '', channel: '' };

function init() {
  if (isUnlocked()) {
    boot();
  } else {
    renderGate(boot);
  }
}

function boot() {
  allOrders = getAllOrders();
  renderPage();
}

function renderPage() {
  const stats = computeStats(allOrders);
  const root = document.getElementById('app-root');

  const content = `
    <div class="stat-grid">
      ${statCard('Pedidos totais', stats.totalOrders, `${stats.todayOrders} hoje`)}
      ${statCard('Faturamento pago', formatBRL(stats.revenue), `${stats.paidOrders} pedido(s) pago(s)`)}
      ${statCard('Ticket médio', formatBRL(stats.avgTicket), 'sobre pedidos pagos')}
      ${statCard('Aguardando confirmação', stats.pendingOrders, 'pagamento ou revisão')}
      ${statCard('Loja online / PDV', `${stats.onlineCount} / ${stats.pdvCount}`, 'pedidos por canal')}
    </div>

    <div class="panel">
      <h2>Pedidos</h2>
      <div class="table-toolbar">
        <input type="search" id="search-input" placeholder="Buscar por número, nome ou e-mail..." />
        <select id="status-filter">
          <option value="">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="aguardando confirmação">Aguardando confirmação</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select id="channel-filter">
          <option value="">Todos os canais</option>
          <option value="online">Loja online</option>
          <option value="pdv">PDV (balcão)</option>
        </select>
      </div>
      <div id="orders-table-wrap"></div>
    </div>

    <div id="order-modal-root"></div>
  `;

  root.innerHTML = renderShell({
    active: 'pedidos',
    title: 'Pedidos',
    subtitle: allOrders.length
      ? `${allOrders.length} pedido(s) encontrados neste navegador/computador.`
      : 'Nenhum pedido ainda.',
    content,
  });

  bindShellEvents();
  renderTable();

  document.getElementById('search-input').addEventListener('input', (e) => {
    filters.search = e.target.value.trim().toLowerCase();
    renderTable();
  });
  document.getElementById('status-filter').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderTable();
  });
  document.getElementById('channel-filter').addEventListener('change', (e) => {
    filters.channel = e.target.value;
    renderTable();
  });
}

function statCard(label, value, sub) {
  return `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${escapeHtml(sub)}</div>
    </div>`;
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (filters.status && o.payment?.status !== filters.status) return false;
    if (filters.channel && o.channel !== filters.channel) return false;
    if (filters.search) {
      const haystack = `${o.id} ${o.customer?.firstName || ''} ${o.customer?.lastName || ''} ${o.customer?.email || ''}`.toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    return true;
  });
}

function renderTable() {
  const wrap = document.getElementById('orders-table-wrap');
  const list = getFilteredOrders();

  if (!list.length) {
    wrap.innerHTML = `
      <div class="empty-note">
        <strong>Nenhum pedido encontrado.</strong>
        <span>Pedidos feitos na loja online ou registrados no PDV aparecem aqui automaticamente.</span>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr>
          <th>Pedido</th><th>Data</th><th>Cliente</th><th>Canal</th><th>Itens</th><th>Total</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((o) => `
          <tr data-order-id="${o.id}">
            <td><strong>#${o.id}</strong></td>
            <td>${formatDate(o.date)}</td>
            <td>${escapeHtml(`${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || '—')}</td>
            <td><span class="badge-pill badge-${o.channel}">${o.channel === 'pdv' ? 'PDV' : 'Loja online'}</span></td>
            <td>${(o.items || []).reduce((s, i) => s + i.qty, 0)} peça(s)</td>
            <td>${formatBRL(o.total)}</td>
            <td>${statusBadge(o.payment?.status)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('tr[data-order-id]').forEach((row) => {
    row.addEventListener('click', () => openOrderModal(row.getAttribute('data-order-id')));
  });
}

function statusBadge(status) {
  const cls = status === 'pago' ? 'badge-pago' : status === 'cancelado' ? 'badge-cancelado' : 'badge-pendente';
  const label = status === 'pago' ? 'Pago' : status === 'cancelado' ? 'Cancelado' : 'Aguardando';
  return `<span class="badge-pill ${cls}">${label}</span>`;
}

function openOrderModal(id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;
  const root = document.getElementById('order-modal-root');

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close" aria-label="Fechar">${icon('x')}</button>
        <h2 style="font-size:19px;margin-bottom:4px;">Pedido #${order.id}</h2>
        <p style="color:var(--color-text-soft);font-size:12.5px;margin-bottom:16px;">${formatDate(order.date)} · ${order.channel === 'pdv' ? 'Venda no balcão (PDV)' : 'Loja online'}</p>

        <div class="detail-row"><span>Cliente</span><span>${escapeHtml(`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || '—')}</span></div>
        ${order.customer?.email ? `<div class="detail-row"><span>E-mail</span><span>${escapeHtml(order.customer.email)}</span></div>` : ''}
        ${order.customer?.phone ? `<div class="detail-row"><span>Telefone</span><span>${escapeHtml(order.customer.phone)}</span></div>` : ''}
        ${order.address ? `<div class="detail-row"><span>Endereço</span><span>${escapeHtml(order.address.street || '')}, ${escapeHtml(order.address.number || '')} — ${escapeHtml(order.address.city || '')}/${escapeHtml(order.address.state || '')}</span></div>` : ''}
        <div class="detail-row"><span>Pagamento</span><span>${escapeHtml(order.payment?.method || '—')}</span></div>
        <div class="detail-row"><span>Status</span><span>${statusBadge(order.payment?.status)}</span></div>

        <div class="detail-items">
          ${(order.items || []).map((i) => `
            <div class="detail-item-line">
              <img src="${i.image || ''}" alt="${escapeHtml(i.name)}" onerror="this.style.visibility='hidden'">
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

        <div class="status-actions">
          <button class="btn btn-outline btn-sm" data-set-status="pago">Marcar como pago</button>
          <button class="btn btn-outline btn-sm" data-set-status="aguardando confirmação">Aguardando</button>
          <button class="btn btn-outline btn-sm" data-set-status="cancelado">Cancelar pedido</button>
        </div>
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  root.querySelectorAll('[data-set-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateOrderStatus(order.id, btn.getAttribute('data-set-status'));
      allOrders = getAllOrders();
      renderPage();
    });
  });
}

function closeModal() {
  document.getElementById('order-modal-root').innerHTML = '';
}

init();
