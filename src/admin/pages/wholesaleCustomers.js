import { getWholesaleCustomers, updateWholesaleCustomer, setWholesaleCustomerStatus } from '../wholesaleCustomerStore.js';
import { formatBRL, formatDate } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';
import { isValidEmail, isValidDoc, onlyDigits, formatCpf, formatCnpj } from '../../utils/validators.js';

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

let state = { search: '' };
let allCustomers = [];

export async function render() {
  allCustomers = await getWholesaleCustomers();
  return `
    <div class="panel">
      <div class="table-toolbar">
        <input type="search" id="search-input" placeholder="Buscar por nome, loja, e-mail ou documento..." value="${escapeHtml(state.search)}" />
      </div>
      <div id="customers-table-wrap"></div>
    </div>
    <div id="customer-modal-root"></div>
  `;
}

function formatDoc(customer) {
  return customer.docType === 'cnpj' ? formatCnpj(customer.docNumber) : formatCpf(customer.docNumber);
}

function getFiltered() {
  if (!state.search) return allCustomers;
  const term = state.search.toLowerCase();
  return allCustomers.filter((c) => `${c.fullName} ${c.storeName} ${c.email} ${c.docNumber}`.toLowerCase().includes(term));
}

function statusBadge(customer) {
  return customer.status === 'active'
    ? `<span class="badge-pill badge-pago">Atacado ativo</span>`
    : `<span class="badge-pill badge-pendente">Varejo (atacado desativado)</span>`;
}

function renderTable() {
  const wrap = document.getElementById('customers-table-wrap');
  const customers = getFiltered();

  if (!customers.length) {
    wrap.innerHTML = `<div class="empty-note"><strong>Nenhum cliente atacadista encontrado.</strong><span>Ajuste a busca ou aguarde novos cadastros pela loja.</span></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr><th>Cliente</th><th>Documento</th><th>Contato</th><th>Cidade/UF</th><th>Pedidos</th><th>Total gasto</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${customers.map((c) => `
          <tr data-customer-id="${c.id}">
            <td><strong>${escapeHtml(c.fullName)}</strong>${c.storeName ? `<br><span style="color:var(--color-text-faint);">${escapeHtml(c.storeName)}</span>` : ''}</td>
            <td>${escapeHtml(formatDoc(c))}<br><span style="color:var(--color-text-faint);">${c.docType === 'cnpj' ? 'CNPJ' : 'CPF'}</span></td>
            <td>${escapeHtml(c.email || '—')}<br><span style="color:var(--color-text-faint);">${escapeHtml(c.phone || '')}</span></td>
            <td>${escapeHtml([c.address?.city, c.address?.state].filter(Boolean).join('/') || '—')}</td>
            <td>${c.ordersCount}</td>
            <td>${formatBRL(c.totalSpent)}</td>
            <td>${statusBadge(c)}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-edit="${c.id}">${icon('edit', 'icon icon-sm')} Editar</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-edit')));
  });
}

function docLabelFor(docType) {
  return docType === 'cnpj' ? 'CNPJ' : 'CPF';
}

function openEditModal(id) {
  const customer = allCustomers.find((c) => c.id === id);
  if (!customer) return;
  const root = document.getElementById('customer-modal-root');
  let docType = customer.docType;

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <button class="modal-close" id="modal-close">${icon('x')}</button>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <div>
            <h2 style="font-size:19px;margin-bottom:2px;">${escapeHtml(customer.fullName)}</h2>
            <p style="color:var(--color-text-soft);font-size:12.5px;">Cadastrado em ${formatDate(customer.createdAt)}</p>
          </div>
          <button type="button" class="btn btn-sm ${customer.status === 'active' ? 'btn-primary' : 'btn-outline'}" id="toggle-status-btn">
            ${customer.status === 'active' ? 'Atacado ativo — clique para desativar' : 'Ativar atacado'}
          </button>
        </div>

        <form id="edit-customer-form" class="admin-form">
          <div class="form-row">
            <label>Tipo de cadastro
              <select name="docType" id="edit-doc-type">
                <option value="cpf" ${docType === 'cpf' ? 'selected' : ''}>Pessoa Física (CPF)</option>
                <option value="cnpj" ${docType === 'cnpj' ? 'selected' : ''}>Pessoa Jurídica (CNPJ)</option>
              </select>
            </label>
            <label id="edit-doc-label">${docLabelFor(docType)}<input type="text" name="docNumber" id="edit-doc-number" value="${escapeHtml(formatDoc(customer))}" required></label>
          </div>
          <label id="edit-name-label">${docType === 'cnpj' ? 'Razão social' : 'Nome completo'}<input type="text" name="fullName" id="edit-fullname" value="${escapeHtml(customer.fullName)}" required></label>
          <div class="form-row">
            <label>Nome da loja<input type="text" name="storeName" value="${escapeHtml(customer.storeName || '')}"></label>
            <label>Telefone / WhatsApp<input type="text" name="phone" value="${escapeHtml(customer.phone || '')}"></label>
          </div>
          <label>E-mail<input type="email" name="email" value="${escapeHtml(customer.email || '')}" required></label>

          <p style="font-size:11.5px;color:var(--color-text-faint);margin-top:10px;">A senha não pode ser vista nem editada por aqui — o cliente troca a própria senha em "Minha Conta" ou pelo link de "Esqueci minha senha".</p>

          <h3 style="font-size:13px;margin-top:16px;margin-bottom:8px;">Endereço</h3>
          <div class="form-row">
            <label>CEP<input type="text" name="cep" value="${escapeHtml(customer.address?.cep || '')}"></label>
            <label>Cidade<input type="text" name="city" value="${escapeHtml(customer.address?.city || '')}"></label>
          </div>
          <div class="form-row">
            <label>Endereço<input type="text" name="street" value="${escapeHtml(customer.address?.street || '')}"></label>
            <label>Número<input type="text" name="number" value="${escapeHtml(customer.address?.number || '')}"></label>
          </div>
          <div class="form-row">
            <label>Complemento<input type="text" name="complement" value="${escapeHtml(customer.address?.complement || '')}"></label>
            <label>Bairro<input type="text" name="neighborhood" value="${escapeHtml(customer.address?.neighborhood || '')}"></label>
          </div>
          <label>Estado
            <select name="state" style="max-width:140px;">
              <option value="">Selecione</option>
              ${STATES.map((s) => `<option value="${s}" ${customer.address?.state === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>

          <button type="submit" class="btn btn-primary btn-block" style="margin-top:14px;">Salvar alterações</button>
        </form>

        <div style="margin-top:20px;border-top:1px solid var(--color-border);padding-top:16px;">
          <strong style="font-size:12.5px;">Pedidos (${customer.ordersCount})</strong>
          <p style="font-size:11.5px;color:var(--color-text-faint);margin-top:4px;">Veja o histórico completo em Pedidos, filtrando por este cliente.</p>
        </div>
      </div>
    </div>`;

  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('edit-doc-type').addEventListener('change', (e) => {
    docType = e.target.value;
    document.getElementById('edit-doc-label').firstChild.textContent = docLabelFor(docType);
    document.getElementById('edit-name-label').firstChild.textContent = docType === 'cnpj' ? 'Razão social' : 'Nome completo';
    document.getElementById('edit-doc-number').value = '';
  });
  document.getElementById('edit-doc-number').addEventListener('input', (e) => {
    e.target.value = docType === 'cnpj' ? formatCnpj(e.target.value) : formatCpf(e.target.value);
  });

  document.getElementById('toggle-status-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const nextStatus = customer.status === 'active' ? 'inactive' : 'active';
    try {
      await setWholesaleCustomerStatus(customer.id, nextStatus);
      allCustomers = await getWholesaleCustomers();
      renderTable();
      openEditModal(customer.id);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('edit-customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());

    if (!data.fullName?.trim()) { alert('Informe o nome completo / razão social.'); return; }
    if (!isValidEmail(data.email)) { alert('Informe um e-mail válido.'); return; }
    if (!isValidDoc(docType, data.docNumber)) { alert(docType === 'cnpj' ? 'CNPJ inválido.' : 'CPF inválido.'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await updateWholesaleCustomer(customer.id, {
        docType,
        docNumber: onlyDigits(data.docNumber),
        fullName: data.fullName,
        storeName: data.storeName,
        phone: data.phone,
        email: data.email,
        address: { cep: data.cep, street: data.street, number: data.number, complement: data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state },
      });
      allCustomers = await getWholesaleCustomers();
      renderTable();
      closeModal();
    } catch (err) {
      alert(err.message || 'Não foi possível salvar as alterações.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function closeModal() {
  document.getElementById('customer-modal-root').innerHTML = '';
}

export async function afterRender() {
  renderTable();

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderTable();
  });
}
