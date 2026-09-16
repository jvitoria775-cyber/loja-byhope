import { getAllCustomers, addManualCustomer, removeManualCustomer, exportCustomersCsv } from '../customerStore.js';
import { formatBRL, formatDate } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

let state = { search: '' };

export async function render() {
  return `
    <div class="panel">
      <div class="table-toolbar">
        <input type="search" id="search-input" placeholder="Buscar por nome ou e-mail..." value="${escapeHtml(state.search)}" />
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-outline btn-sm" id="export-csv-btn">${icon('download', 'icon icon-sm')} Exportar CSV</button>
          <button type="button" class="btn btn-primary btn-sm" id="new-customer-btn">${icon('plus', 'icon icon-sm')} Novo cliente</button>
        </div>
      </div>
      <div id="customers-table-wrap"></div>
    </div>
    <div id="customer-modal-root"></div>
  `;
}

function getFiltered() {
  const all = getAllCustomers();
  if (!state.search) return all;
  const term = state.search.toLowerCase();
  return all.filter((c) => `${c.fullName} ${c.email}`.toLowerCase().includes(term));
}

function renderTable() {
  const wrap = document.getElementById('customers-table-wrap');
  const customers = getFiltered();

  if (!customers.length) {
    wrap.innerHTML = `<div class="empty-note"><strong>Nenhum cliente encontrado.</strong><span>Ajuste a busca ou cadastre um novo cliente.</span></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr><th>Cliente</th><th>Contato</th><th>Cidade/UF</th><th>Pedidos</th><th>Total gasto</th><th>Cliente desde</th></tr>
      </thead>
      <tbody>
        ${customers.map((c) => `
          <tr data-customer-id="${c.id}">
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="avatar-initials">${escapeHtml(c.initials)}</span>
                <strong>${escapeHtml(c.fullName)}</strong>
              </div>
            </td>
            <td>${escapeHtml(c.email || '—')}<br><span style="color:var(--color-text-faint);">${escapeHtml(c.phone || '')}</span></td>
            <td>${escapeHtml([c.city, c.state].filter(Boolean).join('/') || '—')}</td>
            <td>${c.ordersCount}</td>
            <td>${formatBRL(c.totalSpent)}</td>
            <td>${formatDate(c.createdAt)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('tr[data-customer-id]').forEach((row) => {
    row.addEventListener('click', () => openProfileDrawer(row.getAttribute('data-customer-id')));
  });
}

function openProfileDrawer(id) {
  const customer = getAllCustomers().find((c) => c.id === id);
  if (!customer) return;
  const root = document.getElementById('customer-modal-root');

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span class="avatar-initials avatar-initials-lg">${escapeHtml(customer.initials)}</span>
          <div>
            <h2 style="font-size:19px;margin-bottom:2px;">${escapeHtml(customer.fullName)}</h2>
            <p style="color:var(--color-text-soft);font-size:12.5px;">Cliente desde ${formatDate(customer.createdAt)}</p>
          </div>
        </div>

        <div class="detail-row"><span>E-mail</span><span>${escapeHtml(customer.email || '—')}</span></div>
        <div class="detail-row"><span>Telefone</span><span>${escapeHtml(customer.phone || '—')}</span></div>
        <div class="detail-row"><span>Cidade/UF</span><span>${escapeHtml([customer.city, customer.state].filter(Boolean).join('/') || '—')}</span></div>
        <div class="detail-row"><span>Total de pedidos</span><span>${customer.ordersCount}</span></div>
        <div class="detail-row"><span><strong>Valor total gasto (LTV)</strong></span><span><strong>${formatBRL(customer.totalSpent)}</strong></span></div>

        <div style="margin-top:18px;">
          <strong style="font-size:12.5px;">Histórico de pedidos</strong>
          <div class="history-timeline">
            ${customer.orders.length ? customer.orders.map((o) => `
              <div class="history-row">
                <span class="history-dot"></span>
                <div><strong>#${o.id} · ${formatBRL(o.total)}</strong><span>${formatDate(o.date)} · ${escapeHtml(o.fulfillmentStatus)}</span></div>
              </div>`).join('') : '<p style="color:var(--color-text-soft);font-size:13px;">Nenhum pedido registrado ainda.</p>'}
          </div>
        </div>

        ${customer.manual ? `<button type="button" class="btn btn-outline btn-block" id="remove-customer-btn" style="margin-top:18px;color:#B3261E;border-color:#B3261E;">${icon('trash', 'icon icon-sm')} Remover contato</button>` : ''}
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('remove-customer-btn')?.addEventListener('click', () => {
    removeManualCustomer(customer.id);
    closeModal();
    renderTable();
  });
}

function openNewCustomerModal() {
  const root = document.getElementById('customer-modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <h2 style="font-size:19px;margin-bottom:16px;">Novo cliente</h2>
        <form id="new-customer-form" class="admin-form">
          <div class="form-row">
            <label>Nome<input type="text" name="firstName" required></label>
            <label>Sobrenome<input type="text" name="lastName"></label>
          </div>
          <label>E-mail<input type="email" name="email"></label>
          <div class="form-row">
            <label>Telefone<input type="text" name="phone" placeholder="(00) 00000-0000"></label>
            <label>Cidade<input type="text" name="city"></label>
          </div>
          <label>Estado (UF)<input type="text" name="state" maxlength="2" style="max-width:100px;"></label>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px;">Salvar cliente</button>
        </form>
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('new-customer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.firstName?.trim()) return;
    addManualCustomer(data);
    closeModal();
    renderTable();
  });
}

function closeModal() {
  document.getElementById('customer-modal-root').innerHTML = '';
}

function downloadCsv() {
  const csv = exportCustomersCsv(getFiltered());
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-gratitude-textil-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function afterRender() {
  renderTable();

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderTable();
  });
  document.getElementById('export-csv-btn').addEventListener('click', downloadCsv);
  document.getElementById('new-customer-btn').addEventListener('click', openNewCustomerModal);
}
