import { login, getCurrentUser, requestPasswordReset, resetPassword } from '../context/authStore.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils/dom.js';

export function render(params, query = {}) {
  const user = getCurrentUser();
  if (user) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Olá, ${escapeHtml((user.fullName || '').split(' ')[0])}!</h1>
        <p class="section-sub">Você está conectado(a) com o e-mail ${escapeHtml(user.email)}.</p>
        <a href="#/produtos" class="btn btn-primary btn-block">Ir às compras</a>
        <a href="#/minha-conta" class="btn btn-outline btn-block" style="margin-top:10px;">Minha conta</a>
      </div>
    </div>`;
  }

  if (query.token) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Criar nova senha</h1>
        <p class="section-sub">Defina uma nova senha para sua conta atacadista.</p>
        <form id="reset-form">
          <div class="form-field">
            <label for="reset-password">Nova senha</label>
            <input type="password" id="reset-password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" />
          </div>
          <div class="form-field">
            <label for="reset-confirm">Confirmar nova senha</label>
            <input type="password" id="reset-confirm" name="confirm" required minlength="6" placeholder="Repita a senha" />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Salvar nova senha</button>
        </form>
      </div>
    </div>`;
  }

  return `
  <div class="auth-page">
    <div class="auth-card">
      <h1>Entrar</h1>
      <p class="section-sub">Acesse sua conta para acompanhar seus pedidos e, se você for atacadista, ver os preços exclusivos.</p>
      <form id="login-form">
        <div class="form-field">
          <label for="login-email">E-mail</label>
          <input type="email" id="login-email" name="email" required placeholder="voce@email.com" />
        </div>
        <div class="form-field">
          <label for="login-password">Senha</label>
          <input type="password" id="login-password" name="password" required placeholder="••••••••" minlength="6" />
        </div>
        <div style="text-align:right;margin:-8px 0 18px;">
          <button type="button" class="btn-link" id="forgot-btn" style="font-size:12.5px;">Esqueci minha senha</button>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Entrar</button>
      </form>
      <div class="auth-divider">ou</div>
      <p class="auth-switch">Ainda não tem conta? <a href="#/cadastro" class="btn-link">Cadastre-se gratuitamente</a></p>
    </div>
  </div>`;
}

export function afterRender(params, query = {}) {
  document.title = 'Entrar | GRATITUDE TÊXTIL';
  const user = getCurrentUser();
  if (user) return;

  if (query.token) {
    bindResetForm(query.token);
    return;
  }

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await login({ email, password });
    submitBtn.disabled = false;
    if (result.ok) {
      showToast(`Bem-vindo(a) de volta, ${(result.user.fullName || '').split(' ')[0]}!`, 'success');
      navigate('/');
    } else {
      showToast(result.message, 'error');
    }
  });

  document.getElementById('forgot-btn')?.addEventListener('click', async () => {
    const email = prompt('Informe o e-mail cadastrado na sua conta atacadista:');
    if (!email) return;
    const result = await requestPasswordReset(email.trim());
    showToast(result.message, 'info', 6000);
  });
}

function bindResetForm(token) {
  document.title = 'Redefinir senha | GRATITUDE TÊXTIL';
  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-confirm').value;
    if (password !== confirm) {
      showToast('As senhas não coincidem.', 'error');
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await resetPassword(token, password);
    submitBtn.disabled = false;
    if (result.ok) {
      showToast('Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
      navigate('/login');
    } else {
      showToast(result.message, 'error');
    }
  });
}
