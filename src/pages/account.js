import { getCurrentUser, getToken, fetchMyAccount, updateProfile, changePassword, logout } from '../context/authStore.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils/dom.js';
import { formatBRL, formatDate } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { attachPasswordToggle } from '../components/passwordToggle.js';

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

let account = null;
let activeTab = 'dados';

export async function render(params, query = {}) {
  if (!getToken()) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Minha Conta</h1>
        <p class="section-sub">Entre com sua conta para ver seus dados e pedidos.</p>
        <a href="#/login" class="btn btn-primary btn-block">Entrar</a>
        <p class="auth-switch">Ainda não tem conta? <a href="#/cadastro" class="btn-link">Cadastre-se gratuitamente</a></p>
      </div>
    </div>`;
  }

  try {
    account = await fetchMyAccount();
  } catch {
    account = null;
  }

  if (!account) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Sessão expirada</h1>
        <p class="section-sub">Faça login novamente para acessar sua conta.</p>
        <a href="#/login" class="btn btn-primary btn-block">Entrar</a>
      </div>
    </div>`;
  }

  activeTab = query.aba === 'pedidos' ? 'pedidos' : 'dados';
  const { customer } = account;

  return `
  <div class="auth-page auth-page-wide">
    <div class="auth-card">
      <div style="text-align:center;margin-bottom:14px;">
        ${customer.status !== 'inactive'
          ? `<span class="wholesale-badge">${icon('store', 'icon icon-sm')} Cliente Atacadista</span>`
          : `<span class="wholesale-badge" style="color:var(--color-text-soft);background:var(--color-bg-alt);">Conta cadastrada — preço de atacado desativado</span>`}
      </div>
      <h1>Minha Conta</h1>
      <p class="section-sub">Olá, ${escapeHtml(customer.fullName)} · ${escapeHtml(customer.email)}</p>

      <div class="tab-headers" id="account-tabs">
        <button data-tab="dados" class="${activeTab === 'dados' ? 'active' : ''}">Meus dados</button>
        <button data-tab="endereco" class="${activeTab === 'endereco' ? 'active' : ''}">Meu endereço</button>
        <button data-tab="pedidos" class="${activeTab === 'pedidos' ? 'active' : ''}">Meus pedidos</button>
        <button data-tab="senha" class="${activeTab === 'senha' ? 'active' : ''}">Alterar senha</button>
      </div>

      <div class="tab-panel" data-panel="dados" ${activeTab !== 'dados' ? 'hidden' : ''}>${dadosTabHtml(customer)}</div>
      <div class="tab-panel" data-panel="endereco" ${activeTab !== 'endereco' ? 'hidden' : ''}>${enderecoTabHtml(customer)}</div>
      <div class="tab-panel" data-panel="pedidos" ${activeTab !== 'pedidos' ? 'hidden' : ''}>${pedidosTabHtml(account.orders || [])}</div>
      <div class="tab-panel" data-panel="senha" ${activeTab !== 'senha' ? 'hidden' : ''}>${senhaTabHtml()}</div>

      <div style="margin-top:24px;border-top:1px solid var(--color-border-soft);padding-top:20px;">
        <button type="button" class="btn btn-outline btn-block" id="account-logout-page-btn">Sair da conta</button>
      </div>
    </div>
  </div>`;
}

function dadosTabHtml(customer) {
  const docLabel = customer.docType === 'cnpj' ? 'CNPJ' : 'CPF';
  return `
  <form id="dados-form">
    <div class="form-grid">
      <div class="form-field full" data-field="fullName">
        <label for="acc-fullname">${customer.docType === 'cnpj' ? 'Razão social' : 'Nome completo'}</label>
        <input type="text" id="acc-fullname" name="fullName" required value="${escapeHtml(customer.fullName || '')}" />
        <span class="error-msg">Informe o nome completo.</span>
      </div>
      <div class="form-field">
        <label>${docLabel}</label>
        <input type="text" value="${escapeHtml(customer.docNumber || '')}" disabled />
      </div>
      <div class="form-field">
        <label>E-mail</label>
        <input type="text" value="${escapeHtml(customer.email || '')}" disabled />
      </div>
      <div class="form-field">
        <label for="acc-store">Nome da loja</label>
        <input type="text" id="acc-store" name="storeName" value="${escapeHtml(customer.storeName || '')}" />
      </div>
      <div class="form-field">
        <label for="acc-phone">Telefone / WhatsApp</label>
        <input type="tel" id="acc-phone" name="phone" required value="${escapeHtml(customer.phone || '')}" />
        <span class="error-msg">Informe um telefone de contato.</span>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Salvar dados</button>
  </form>`;
}

function enderecoTabHtml(customer) {
  const addr = customer.address || {};
  return `
  <form id="endereco-form">
    <div class="form-grid">
      <div class="form-field" data-field="cep">
        <label for="acc-cep">CEP</label>
        <input type="text" id="acc-cep" name="cep" required value="${escapeHtml(addr.cep || '')}" />
        <span class="error-msg">Informe o CEP.</span>
      </div>
      <div class="form-field" data-field="street">
        <label for="acc-street">Endereço</label>
        <input type="text" id="acc-street" name="street" required value="${escapeHtml(addr.street || '')}" />
        <span class="error-msg">Informe o endereço.</span>
      </div>
      <div class="form-field" data-field="number">
        <label for="acc-number">Número</label>
        <input type="text" id="acc-number" name="number" required value="${escapeHtml(addr.number || '')}" />
        <span class="error-msg">Informe o número.</span>
      </div>
      <div class="form-field" data-field="complement">
        <label for="acc-complement">Complemento (opcional)</label>
        <input type="text" id="acc-complement" name="complement" value="${escapeHtml(addr.complement || '')}" />
      </div>
      <div class="form-field" data-field="neighborhood">
        <label for="acc-neighborhood">Bairro</label>
        <input type="text" id="acc-neighborhood" name="neighborhood" required value="${escapeHtml(addr.neighborhood || '')}" />
        <span class="error-msg">Informe o bairro.</span>
      </div>
      <div class="form-field" data-field="city">
        <label for="acc-city">Cidade</label>
        <input type="text" id="acc-city" name="city" required value="${escapeHtml(addr.city || '')}" />
        <span class="error-msg">Informe a cidade.</span>
      </div>
      <div class="form-field" data-field="state">
        <label for="acc-state">Estado</label>
        <select id="acc-state" name="state" required>
          <option value="">Selecione</option>
          ${STATES.map((s) => `<option value="${s}" ${addr.state === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="error-msg">Selecione um estado.</span>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Salvar endereço</button>
  </form>`;
}

function pedidosTabHtml(orders) {
  if (!orders.length) {
    return `
    <div class="empty-state" style="padding:40px 20px;">
      <div class="icon-circle">${icon('package', 'icon')}</div>
      <h3>Você ainda não fez nenhum pedido.</h3>
      <p>Seus pedidos vão aparecer aqui.</p>
      <a href="#/produtos" class="btn btn-outline">Explorar produtos</a>
    </div>`;
  }
  return orders.map((order) => `
    <div class="order-card" style="margin:0 0 20px;">
      <div class="order-card-row"><span>Pedido</span><strong>#${escapeHtml(order.id)}</strong></div>
      <div class="order-card-row"><span>Data</span><span>${formatDate(order.date)}</span></div>
      <div class="order-card-row"><span>Itens</span><span>${(order.items || []).reduce((s, i) => s + i.qty, 0)} peça(s)</span></div>
      <div class="order-card-row"><span>Status</span><span style="text-transform:capitalize;">${escapeHtml(order.fulfillmentStatus || order.payment?.status || 'pendente')}</span></div>
      <div class="order-card-row"><span><strong>Total pago</strong></span><span><strong>${formatBRL(order.total)}</strong></span></div>
      <a href="#/pedido/${escapeHtml(order.id)}" class="btn-link" style="display:inline-block;margin-top:10px;">Ver detalhes do pedido</a>
    </div>`).join('');
}

function senhaTabHtml() {
  return `
  <form id="senha-form">
    <div class="form-field">
      <label for="acc-current-password">Senha atual</label>
      <input type="password" id="acc-current-password" name="currentPassword" required minlength="6" />
    </div>
    <div class="form-field">
      <label for="acc-new-password">Nova senha</label>
      <input type="password" id="acc-new-password" name="newPassword" required minlength="6" placeholder="Mínimo 6 caracteres" />
    </div>
    <div class="form-field">
      <label for="acc-new-password-confirm">Confirmar nova senha</label>
      <input type="password" id="acc-new-password-confirm" name="confirm" required minlength="6" />
    </div>
    <button type="submit" class="btn btn-primary btn-block">Alterar senha</button>
  </form>`;
}

export function afterRender() {
  document.title = 'Minha Conta | GRATITUDE TÊXTIL';
  if (!getCurrentUser() || !account) return;

  attachPasswordToggle('acc-current-password');
  attachPasswordToggle('acc-new-password');
  attachPasswordToggle('acc-new-password-confirm');

  document.querySelectorAll('#account-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#account-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.getAttribute('data-panel') !== tab; });
    });
  });

  document.getElementById('dados-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await updateProfile({ fullName: data.fullName, storeName: data.storeName, phone: data.phone });
    submitBtn.disabled = false;
    showToast(result.ok ? 'Dados salvos com sucesso.' : result.message, result.ok ? 'success' : 'error');
  });

  document.getElementById('endereco-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await updateProfile({ address: data });
    submitBtn.disabled = false;
    showToast(result.ok ? 'Endereço salvo com sucesso.' : result.message, result.ok ? 'success' : 'error');
  });

  document.getElementById('senha-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (data.newPassword !== data.confirm) {
      showToast('As senhas não coincidem.', 'error');
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
    submitBtn.disabled = false;
    if (result.ok) {
      showToast('Senha alterada com sucesso.', 'success');
      e.target.reset();
    } else {
      showToast(result.message, 'error');
    }
  });

  document.getElementById('account-logout-page-btn')?.addEventListener('click', () => {
    logout();
    showToast('Você saiu da sua conta.', 'info');
    navigate('/');
  });
}
