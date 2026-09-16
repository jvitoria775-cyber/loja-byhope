import { login, getCurrentUser } from '../context/authStore.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

export function render() {
  const user = getCurrentUser();
  if (user) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Olá, ${user.name.split(' ')[0]}!</h1>
        <p class="section-sub">Você está conectada com o e-mail ${user.email}.</p>
        <a href="#/produtos" class="btn btn-primary btn-block">Ir às compras</a>
        <button class="btn btn-outline btn-block" id="logout-btn" style="margin-top:10px;">Sair da conta</button>
      </div>
    </div>`;
  }

  return `
  <div class="auth-page">
    <div class="auth-card">
      <h1>Entrar</h1>
      <p class="section-sub">Acesse sua conta para acompanhar pedidos e favoritos.</p>
      <form id="login-form">
        <div class="form-field">
          <label for="login-email">E-mail</label>
          <input type="email" id="login-email" name="email" required placeholder="voce@email.com" />
        </div>
        <div class="form-field">
          <label for="login-password">Senha</label>
          <input type="password" id="login-password" name="password" required placeholder="••••••••" minlength="4" />
        </div>
        <div style="text-align:right;margin:-8px 0 18px;">
          <button type="button" class="btn-link" id="forgot-btn" style="font-size:12.5px;">Esqueci minha senha</button>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Entrar</button>
      </form>
      <div class="auth-divider">ou</div>
      <p class="auth-switch">Ainda não tem conta? <a href="#/cadastro" class="btn-link">Cadastre-se</a></p>
    </div>
  </div>`;
}

export function afterRender() {
  document.title = 'Entrar | GRATITUDE TÊXTIL';
  const user = getCurrentUser();

  if (user) {
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      const { logout } = await import('../context/authStore.js');
      logout();
      showToast('Você saiu da sua conta.', 'info');
      document.getElementById('app').innerHTML = render();
      afterRender();
    });
    return;
  }

  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const result = login({ email, password });
    if (result.ok) {
      showToast(`Bem-vindo(a) de volta, ${result.user.name.split(' ')[0]}!`, 'success');
      navigate('/');
    } else {
      showToast(result.message, 'error');
    }
  });

  document.getElementById('forgot-btn')?.addEventListener('click', () => {
    showToast('Um link de redefinição de senha foi enviado para o seu e-mail (simulado).', 'info', 4000);
  });
}
