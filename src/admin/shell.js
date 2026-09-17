import { icon } from '../components/icons.js';
import { lock } from './adminAuth.js';

const NAV_ITEMS = [
  { key: 'overview', href: '#', label: 'Visão Geral', iconName: 'trendingUp' },
  { key: 'pedidos', href: '#pedidos', label: 'Pedidos', iconName: 'package' },
  { key: 'clientes', href: '#clientes', label: 'Clientes', iconName: 'users' },
  { key: 'atacadistas', href: '#atacadistas', label: 'Clientes Atacadistas', iconName: 'store' },
  { key: 'produtos', href: '#produtos', label: 'Produtos & Estoque', iconName: 'grid' },
  { key: 'financeiro', href: '#financeiro', label: 'Financeiro', iconName: 'dollarSign' },
  { key: 'configuracoes', href: '#configuracoes', label: 'Configurações', iconName: 'settings' },
];

export function renderShell({ active, title, subtitle, content }) {
  return `
  <div class="admin-shell">
    <div class="admin-sidebar-overlay" id="admin-sidebar-overlay" hidden></div>
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" onerror="this.style.display='none'"></div>
      <nav class="admin-nav">
        ${NAV_ITEMS.map((item) => `<a href="${item.href}" data-nav="${item.key}" class="${active === item.key ? 'active' : ''}">${icon(item.iconName, 'icon')} <span>${item.label}</span></a>`).join('')}
      </nav>
      <div class="admin-nav" style="margin-top:auto;padding-top:10px;border-top:1px solid rgba(255,255,255,0.12);">
        <a href="/pdv.html">${icon('creditCard', 'icon')} <span>PDV (Balcão)</span></a>
        <a href="/" target="_blank" rel="noopener noreferrer">${icon('arrowRight', 'icon')} <span>Ver loja</span></a>
      </div>
      <div class="admin-sidebar-foot">
        <button type="button" id="lock-btn">${icon('lock', 'icon')} Sair / Bloquear</button>
      </div>
    </aside>
    <main class="admin-main">
      <div class="admin-topbar">
        <button type="button" class="btn-icon-plain" id="hamburger-admin" aria-label="Abrir menu">${icon('menu', 'icon')}</button>
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
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

  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('admin-sidebar-overlay');
  const toggle = () => {
    const isOpen = sidebar.classList.toggle('open');
    overlay.hidden = !isOpen;
  };
  document.getElementById('hamburger-admin')?.addEventListener('click', toggle);
  overlay?.addEventListener('click', toggle);
  sidebar?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.hidden = true;
  }));
}
