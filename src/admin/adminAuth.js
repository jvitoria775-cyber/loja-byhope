// Portão de acesso do painel/PDV por PIN. Diferente da versão anterior
// (que só checava o PIN no navegador), agora o PIN é validado de verdade
// no servidor (/api/auth) - a checagem também é aplicada nos endpoints que
// gravam dados, então não dá mais para simplesmente pular a tela de PIN
// chamando a API direto. Continua sendo um PIN único compartilhado pela
// equipe (como uma senha de alarme de loja), não contas individuais.
const TOKEN_KEY = 'amara_admin_token';

export function isUnlocked() {
  return !!sessionStorage.getItem(TOKEN_KEY);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function tryUnlock(pin) {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) return false;
    sessionStorage.setItem(TOKEN_KEY, data.token);
    return true;
  } catch {
    return false;
  }
}

export function lock() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Usado pela tela de Configurações > Segurança. Lança erro com uma
// mensagem amigável quando o PIN atual está incorreto.
export async function changePin(currentPin, newPin) {
  const res = await fetch('/api/auth', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
    body: JSON.stringify({ currentPin, newPin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível alterar o PIN.');
  return true;
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
        <p class="gate-note">PIN compartilhado da equipe — troque em Configurações sempre que necessário.</p>
      </div>
    </div>`;

  document.getElementById('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('gate-pin');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const ok = await tryUnlock(input.value.trim());
    btn.disabled = false;
    if (ok) {
      root.innerHTML = '';
      onUnlock();
    } else {
      document.getElementById('gate-error').hidden = false;
      input.value = '';
      input.focus();
    }
  });
}
