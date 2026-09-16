import { icon } from '../components/icons.js';
import { lock } from './adminAuth.js';

export function renderShell({ active, title, subtitle, content }) {
  return `
  <div class="admin-shell">
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" onerror="this.style.display='none'"></div>
      <nav class="admin-nav">
        <a href="/admin.html" class="${active === 'pedidos' ? 'active' : ''}">${icon('package', 'icon')} Pedidos</a>
        <a href="/pdv.html" class="${active === 'pdv' ? 'active' : ''}">${icon('creditCard', 'icon')} PDV (Balcão)</a>
        <a href="/" target="_blank" rel="noopener noreferrer">${icon('arrowRight', 'icon')} Ver loja</a>
      </nav>
      <div class="admin-sidebar-foot">
        <button type="button" id="lock-btn">${icon('lock', 'icon')} Sair / Bloquear</button>
      </div>
    </aside>
    <main class="admin-main">
      <div class="admin-topbar">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <button type="button" class="btn btn-outline" id="hamburger-admin" style="display:none;">${icon('menu', 'icon')}</button>
      </div>
      ${content}
    </main>
  </div>`;
}

export function bindShellEvents() {
  document.getElementById('lock-btn')?.addEventListener('click', () => {
    lock();
    location.reload();
  });
}
