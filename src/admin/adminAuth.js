// Portão de acesso simples por PIN local. NÃO é uma autenticação segura de
// verdade (é só JavaScript no navegador, sem servidor validando nada) - serve
// apenas como uma trava básica para não deixar o painel visível para
// qualquer pessoa que abra a URL por engano em um computador da loja.
const PIN = '2026';
const SESSION_KEY = 'amara_admin_session';

export function isUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}

export function tryUnlock(pin) {
  if (pin === PIN) {
    sessionStorage.setItem(SESSION_KEY, 'ok');
    return true;
  }
  return false;
}

export function lock() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function renderGate(onUnlock) {
  const root = document.getElementById('gate-root');
  root.innerHTML = `
    <div class="gate-screen">
      <div class="gate-card">
        <div class="gate-logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" onerror="this.style.display='none'"></div>
        <h1>Acesso restrito</h1>
        <p>Digite o PIN de acesso da equipe para continuar.</p>
        <form id="gate-form">
          <input type="password" inputmode="numeric" id="gate-pin" placeholder="PIN" autofocus />
          <button type="submit" class="btn btn-primary btn-block">Entrar</button>
        </form>
        <p class="gate-error" id="gate-error" hidden>PIN incorreto. Tente novamente.</p>
        <p class="gate-note">Este PIN é uma trava local simples, não uma autenticação segura de produção.</p>
      </div>
    </div>`;

  document.getElementById('gate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('gate-pin');
    if (tryUnlock(input.value.trim())) {
      root.innerHTML = '';
      onUnlock();
    } else {
      document.getElementById('gate-error').hidden = false;
      input.value = '';
      input.focus();
    }
  });
}
