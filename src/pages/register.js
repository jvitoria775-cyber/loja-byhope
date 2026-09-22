import { register, getCurrentUser } from '../context/authStore.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils/dom.js';
import { isValidCpf, isValidCnpj, isValidEmail, formatCpf, formatCnpj, onlyDigits } from '../utils/validators.js';
import { lookupCep } from '../services/cepService.js';
import { isValidCep } from '../services/shippingService.js';
import { attachPasswordToggle } from '../components/passwordToggle.js';

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

let docType = 'cpf';
let accountType = 'wholesale';

export function render(params, query = {}) {
  const user = getCurrentUser();
  if (user) {
    const wholesale = user.status !== 'inactive';
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Você já está conectado(a)</h1>
        <p class="section-sub">Olá, ${escapeHtml((user.fullName || '').split(' ')[0])}! ${wholesale ? 'Sua conta atacadista já está ativa.' : 'Sua conta já está criada.'}</p>
        <a href="#/produtos" class="btn btn-primary btn-block">Ir às compras</a>
      </div>
    </div>`;
  }

  // Só quem chega pelo botão "Quero comprar no atacado" (link com
  // ?tipo=atacado) vê a opção de virar cliente atacadista. Quem chega
  // pelo cadastro genérico (Entrar > Cadastre-se) cai direto num
  // cadastro simples de varejo (só CPF, sem CNPJ/nome da loja) - evita
  // confundir cliente final com um formulário pensado pra revendedor.
  const startWholesale = query.tipo === 'atacado';
  docType = 'cpf';
  accountType = startWholesale ? 'wholesale' : 'retail';

  return `
  <div class="auth-page auth-page-wide">
    <div class="auth-card">
      <div style="text-align:center;margin-bottom:14px;"><span class="wholesale-badge" id="reg-badge">${startWholesale ? 'Cadastro de cliente atacadista' : 'Cadastro de cliente'}</span></div>
      <h1 id="reg-title">${startWholesale ? 'Comprar no Atacado' : 'Criar minha conta'}</h1>
      <p class="section-sub" id="reg-subtitle">${startWholesale ? 'Crie sua conta gratuita para desbloquear os preços de atacado da Gratitude Têxtil.' : 'Crie sua conta gratuita para acompanhar seus pedidos na Gratitude Têxtil.'}</p>

      <form id="register-form" novalidate>
        ${startWholesale ? `
        <p class="form-section-title">Como você vai comprar?</p>
        <div class="doc-type-toggle" id="account-type-toggle">
          <button type="button" data-account-type="wholesale" class="active">Atacado (revenda)</button>
          <button type="button" data-account-type="retail">Varejo (uso próprio)</button>
        </div>

        <p class="form-section-title">Tipo de cadastro</p>
        <div class="doc-type-toggle" id="doc-type-toggle">
          <button type="button" data-doc-type="cpf" class="active">Pessoa Física (CPF)</button>
          <button type="button" data-doc-type="cnpj">Pessoa Jurídica (CNPJ)</button>
        </div>
        <input type="hidden" name="docType" id="reg-doc-type-input" value="cpf" />
        ` : ''}

        <p class="form-section-title">Seus dados</p>
        <div class="form-grid">
          <div class="form-field full" data-field="fullName">
            <label for="reg-fullname" id="reg-fullname-label">Nome completo</label>
            <input type="text" id="reg-fullname" name="fullName" required placeholder="Seu nome completo" />
            <span class="error-msg">Informe o nome completo.</span>
          </div>
          <div class="form-field" data-field="docNumber">
            <label for="reg-doc" id="reg-doc-label">CPF</label>
            <input type="text" id="reg-doc" name="docNumber" required placeholder="000.000.000-00" inputmode="numeric" />
            <span class="error-msg" id="reg-doc-error">CPF inválido.</span>
          </div>
          ${startWholesale ? `
          <div class="form-field" data-field="storeName" id="store-name-field">
            <label for="reg-store">Nome da loja</label>
            <input type="text" id="reg-store" name="storeName" placeholder="Nome da sua loja (opcional)" />
          </div>` : ''}
          <div class="form-field full" data-field="phone">
            <label for="reg-phone">Telefone / WhatsApp</label>
            <input type="tel" id="reg-phone" name="phone" required placeholder="(11) 91234-5678" />
            <span class="error-msg">Informe um telefone de contato.</span>
          </div>
        </div>

        <p class="form-section-title">Acesso à conta</p>
        <div class="form-grid">
          <div class="form-field full" data-field="email">
            <label for="reg-email">E-mail</label>
            <input type="email" id="reg-email" name="email" required placeholder="voce@email.com" />
            <span class="error-msg">Informe um e-mail válido.</span>
          </div>
          <div class="form-field" data-field="password">
            <label for="reg-password">Senha</label>
            <input type="password" id="reg-password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" />
            <span class="error-msg">A senha precisa ter pelo menos 6 caracteres.</span>
          </div>
          <div class="form-field" data-field="confirm">
            <label for="reg-confirm">Confirmar senha</label>
            <input type="password" id="reg-confirm" name="confirm" required minlength="6" placeholder="Repita a senha" />
            <span class="error-msg">As senhas não coincidem.</span>
          </div>
        </div>

        <p class="form-section-title">Endereço</p>
        <div class="form-grid">
          <div class="form-field" data-field="cep">
            <label for="reg-cep">CEP</label>
            <input type="text" id="reg-cep" name="cep" required placeholder="00000-000" />
            <span class="error-msg">Informe o CEP.</span>
          </div>
          <div class="form-field" data-field="street">
            <label for="reg-street">Endereço</label>
            <input type="text" id="reg-street" name="street" required placeholder="Rua, avenida..." />
            <span class="error-msg">Informe o endereço.</span>
          </div>
          <div class="form-field" data-field="number">
            <label for="reg-number">Número</label>
            <input type="text" id="reg-number" name="number" required placeholder="" />
            <span class="error-msg">Informe o número.</span>
          </div>
          <div class="form-field" data-field="complement">
            <label for="reg-complement">Complemento (opcional)</label>
            <input type="text" id="reg-complement" name="complement" placeholder="Apto, bloco..." />
          </div>
          <div class="form-field" data-field="neighborhood">
            <label for="reg-neighborhood">Bairro</label>
            <input type="text" id="reg-neighborhood" name="neighborhood" required placeholder="" />
            <span class="error-msg">Informe o bairro.</span>
          </div>
          <div class="form-field" data-field="city">
            <label for="reg-city">Cidade</label>
            <input type="text" id="reg-city" name="city" required placeholder="" />
            <span class="error-msg">Informe a cidade.</span>
          </div>
          <div class="form-field" data-field="state">
            <label for="reg-state">Estado</label>
            <select id="reg-state" name="state" required>
              <option value="">Selecione</option>
              ${STATES.map((s) => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <span class="error-msg">Selecione um estado.</span>
          </div>
        </div>

        <button type="submit" id="reg-submit-btn" class="btn btn-primary btn-block" style="margin-top:8px;">${startWholesale ? 'Criar minha conta atacadista' : 'Criar minha conta'}</button>
      </form>
      <p class="auth-switch">Já tem conta? <a href="#/login" class="btn-link">Entrar</a></p>
    </div>
  </div>`;
}

function setAccountType(type) {
  accountType = type;
  document.querySelectorAll('#account-type-toggle [data-account-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-account-type') === type);
  });
  const badge = document.getElementById('reg-badge');
  const title = document.getElementById('reg-title');
  const subtitle = document.getElementById('reg-subtitle');
  const submitBtn = document.getElementById('reg-submit-btn');
  const storeField = document.getElementById('store-name-field');
  if (type === 'retail') {
    badge.textContent = 'Cadastro de cliente';
    title.textContent = 'Criar minha conta';
    subtitle.textContent = 'Crie sua conta gratuita para acompanhar seus pedidos na Gratitude Têxtil.';
    submitBtn.textContent = 'Criar minha conta';
    storeField.style.display = 'none';
  } else {
    badge.textContent = 'Cadastro de cliente atacadista';
    title.textContent = 'Comprar no Atacado';
    subtitle.textContent = 'Crie sua conta gratuita para desbloquear os preços de atacado da Gratitude Têxtil.';
    submitBtn.textContent = 'Criar minha conta atacadista';
    storeField.style.display = '';
  }
}

function setDocType(type) {
  docType = type;
  document.getElementById('reg-doc-type-input').value = type;
  document.querySelectorAll('#doc-type-toggle [data-doc-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-doc-type') === type);
  });
  const docInput = document.getElementById('reg-doc');
  const docLabel = document.getElementById('reg-doc-label');
  const docError = document.getElementById('reg-doc-error');
  const nameLabel = document.getElementById('reg-fullname-label');
  if (type === 'cnpj') {
    docLabel.textContent = 'CNPJ';
    docInput.setAttribute('placeholder', '00.000.000/0000-00');
    docError.textContent = 'CNPJ inválido.';
    nameLabel.textContent = 'Razão social';
  } else {
    docLabel.textContent = 'CPF';
    docInput.setAttribute('placeholder', '000.000.000-00');
    docError.textContent = 'CPF inválido.';
    nameLabel.textContent = 'Nome completo';
  }
  docInput.value = '';
}

export function afterRender() {
  if (getCurrentUser()) { document.title = 'Minha Conta | GRATITUDE TÊXTIL'; return; }
  document.title = `${document.getElementById('reg-title')?.textContent || 'Criar conta'} | GRATITUDE TÊXTIL`;

  attachPasswordToggle('reg-password');
  attachPasswordToggle('reg-confirm');

  document.querySelectorAll('#account-type-toggle [data-account-type]').forEach((btn) => {
    btn.addEventListener('click', () => setAccountType(btn.getAttribute('data-account-type')));
  });

  document.querySelectorAll('#doc-type-toggle [data-doc-type]').forEach((btn) => {
    btn.addEventListener('click', () => setDocType(btn.getAttribute('data-doc-type')));
  });

  const docInput = document.getElementById('reg-doc');
  docInput.addEventListener('input', () => {
    docInput.value = docType === 'cnpj' ? formatCnpj(docInput.value) : formatCpf(docInput.value);
  });

  document.getElementById('reg-cep')?.addEventListener('blur', async (e) => {
    if (!isValidCep(e.target.value)) return;
    const address = await lookupCep(e.target.value);
    if (!address) return;
    const streetInput = document.getElementById('reg-street');
    const neighborhoodInput = document.getElementById('reg-neighborhood');
    const cityInput = document.getElementById('reg-city');
    const stateSelect = document.getElementById('reg-state');
    if (streetInput) streetInput.value = address.street;
    if (neighborhoodInput) neighborhoodInput.value = address.neighborhood;
    if (cityInput) cityInput.value = address.city;
    if (stateSelect && address.state) stateSelect.value = address.state;
    [streetInput, neighborhoodInput, cityInput, stateSelect].forEach((input) => {
      input?.closest('.form-field')?.classList.remove('invalid');
    });
    document.getElementById('reg-number')?.focus();
  });

  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    let valid = validateForm(form);

    if (valid && data.password !== data.confirm) {
      markInvalid('confirm');
      valid = false;
    }
    if (valid && !isValidEmail(data.email)) {
      markInvalid('email');
      valid = false;
    }
    if (valid) {
      const docOk = docType === 'cnpj' ? isValidCnpj(data.docNumber) : isValidCpf(data.docNumber);
      if (!docOk) {
        markInvalid('docNumber');
        valid = false;
      }
    }

    if (!valid) {
      showToast('Verifique os campos destacados no formulário.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando sua conta...';

    const result = await register({
      wholesale: accountType === 'wholesale',
      docType,
      docNumber: onlyDigits(data.docNumber),
      fullName: data.fullName,
      storeName: data.storeName,
      phone: data.phone,
      email: data.email,
      password: data.password,
      address: {
        cep: data.cep,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      },
    });

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (result.ok) {
      showToast(`Bem-vindo(a) à Gratitude Têxtil, ${(result.user.fullName || '').split(' ')[0]}!`, 'success');
      navigate('/minha-conta');
    } else {
      showToast(result.message, 'error');
    }
  });
}

function markInvalid(fieldName) {
  document.querySelector(`[data-field="${fieldName}"]`)?.classList.add('invalid');
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
