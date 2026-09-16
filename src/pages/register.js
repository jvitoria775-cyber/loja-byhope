import { register, getCurrentUser } from '../context/authStore.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

export function render() {
  const user = getCurrentUser();
  if (user) {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Você já está conectada</h1>
        <p class="section-sub">Olá, ${user.name.split(' ')[0]}! Sua conta já está ativa.</p>
        <a href="#/produtos" class="btn btn-primary btn-block">Ir às compras</a>
      </div>
    </div>`;
  }

  return `
  <div class="auth-page">
    <div class="auth-card">
      <h1>Criar conta</h1>
      <p class="section-sub">Cadastre-se e ganhe 10% de desconto na primeira compra.</p>
      <form id="register-form">
        <div class="form-field">
          <label for="reg-name">Nome completo</label>
          <input type="text" id="reg-name" name="name" required placeholder="Seu nome completo" />
        </div>
        <div class="form-field">
          <label for="reg-email">E-mail</label>
          <input type="email" id="reg-email" name="email" required placeholder="voce@email.com" />
        </div>
        <div class="form-field">
          <label for="reg-password">Senha</label>
          <input type="password" id="reg-password" name="password" required minlength="4" placeholder="Mínimo 4 caracteres" />
        </div>
        <div class="form-field">
          <label for="reg-confirm">Confirmar senha</label>
          <input type="password" id="reg-confirm" name="confirm" required minlength="4" placeholder="Repita a senha" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Criar minha conta</button>
      </form>
      <p class="auth-switch">Já tem conta? <a href="#/login" class="btn-link">Entrar</a></p>
    </div>
  </div>`;
}

export function afterRender() {
  document.title = 'Criar conta | GRATITUDE TÊXTIL';
  if (getCurrentUser()) return;

  document.getElementById('register-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
      showToast('As senhas não coincidem.', 'error');
      return;
    }

    const result = register({ name, email, password });
    if (result.ok) {
      showToast(`Bem-vindo(a) à GRATITUDE TÊXTIL, ${name.split(' ')[0]}!`, 'success');
      navigate('/');
    } else {
      showToast(result.message, 'error');
    }
  });
}
