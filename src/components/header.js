import { icon } from './icons.js';
import { getCount } from '../context/cartStore.js';
import { getFavoritesCount } from '../context/favoritesStore.js';
import { getCurrentUser, logout } from '../context/authStore.js';
import { openCartDrawer } from './cartDrawer.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils/dom.js';
import { showToast } from './toast.js';

const NAV_ITEMS = [
  { label: 'Início', href: '#/' },
  { label: 'Camisetas', href: '#/produtos?categoria=camiseta' },
  { label: 'Baby Look', href: '#/produtos?categoria=babylook' },
  { label: 'Cropped', href: '#/produtos?categoria=cropped' },
  { label: 'Regata', href: '#/produtos?categoria=regata' },
  { label: 'Moletom', href: '#/produtos?categoria=moletom' },
  { label: 'Shorts', href: '#/produtos?categoria=short' },
];

export function renderHeader() {
  const user = getCurrentUser();
  return `
  <header class="site-header">
    <div class="header-main container">
      <button class="hamburger" id="hamburger-btn" aria-label="Abrir menu" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span><span></span>
      </button>
      <a href="#/" class="logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'GRATITUDE TÊXTIL'}))"></a>
      <nav class="nav" id="main-nav" aria-label="Menu principal">
        ${NAV_ITEMS.map((item) => `<a href="${item.href}" data-nav-link>${item.label}</a>`).join('')}
      </nav>
      <form class="search-form" id="search-form" role="search">
        <label for="search-input" class="sr-only" style="position:absolute;left:-9999px;">Buscar produtos</label>
        <input type="search" id="search-input" placeholder="Buscar camiseta, moletom..." aria-label="Buscar produtos" />
        <button type="submit" aria-label="Buscar">${icon('search', 'icon icon-sm')}</button>
      </form>
      <div class="header-account" id="header-account">${renderAccountArea(user)}</div>

      <div class="header-actions">
        <a href="#/favoritos" class="icon-btn" aria-label="Favoritos">
          ${icon('heart')}
          <span class="badge" id="fav-count" ${getFavoritesCount() === 0 ? 'hidden' : ''}>${getFavoritesCount()}</span>
        </a>
        <button class="icon-btn" id="cart-btn" aria-label="Abrir carrinho">
          ${icon('bag')}
          <span class="badge" id="cart-count" ${getCount() === 0 ? 'hidden' : ''}>${getCount()}</span>
        </button>
      </div>
    </div>

    <div class="mobile-menu" id="mobile-menu" hidden>
      <form class="mobile-search" id="mobile-search-form" role="search" style="display:flex;gap:8px;padding:16px;">
        <input type="search" id="mobile-search-input" placeholder="Buscar produtos..." style="flex:1;padding:12px 14px;border:1px solid var(--color-border);border-radius:999px;" />
        <button class="btn btn-primary btn-sm" type="submit">${icon('search', 'icon icon-sm')}</button>
      </form>
      <div id="mobile-account-links">${renderMobileAccountLinks(user)}</div>
      <nav aria-label="Menu principal mobile" style="display:flex;flex-direction:column;padding:0 20px 24px;">
        ${NAV_ITEMS.map((item) => `<a href="${item.href}" data-nav-link style="padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:15px;">${item.label}</a>`).join('')}
        <a href="#/sobre" style="padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:15px;">Sobre nós</a>
        <a href="#/contato" style="padding:14px 0;font-size:15px;">Contato</a>
      </nav>
    </div>
  </header>`;
}

function renderAccountArea(user) {
  if (user) {
    const firstName = escapeHtml((user.fullName || 'Cliente').split(' ')[0]);
    return `
    <div class="account-widget">
      <button type="button" class="account-trigger" id="account-trigger" aria-haspopup="true" aria-expanded="false">
        ${icon('user', 'icon icon-sm')}<span>Olá, ${firstName}</span>${icon('chevronDown', 'icon icon-sm')}
      </button>
      <div class="account-menu" id="account-menu" hidden>
        <span class="account-menu-tag">${icon('store', 'icon icon-sm')} Cliente Atacadista</span>
        <a href="#/minha-conta" data-account-menu-link>Minha Conta</a>
        <a href="#/minha-conta?aba=pedidos" data-account-menu-link>Meus Pedidos</a>
        <button type="button" id="account-logout-btn">Sair da conta</button>
      </div>
    </div>`;
  }
  return `
  <div class="account-widget account-widget-guest">
    <a href="#/login" class="account-link">Entrar</a>
    <a href="#/atacado" class="account-link account-link-accent">${icon('store', 'icon icon-sm')} Comprar no Atacado</a>
  </div>`;
}

function renderMobileAccountLinks(user) {
  const linkStyle = 'padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:15px;display:block;';
  if (user) {
    const firstName = escapeHtml((user.fullName || 'Cliente').split(' ')[0]);
    return `
    <div style="padding:0 20px;">
      <p style="padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:13px;color:var(--color-text-soft);">Olá, ${firstName} · <span class="account-menu-tag" style="margin-left:4px;">Cliente Atacadista</span></p>
      <a href="#/minha-conta" data-nav-link style="${linkStyle}">Minha Conta</a>
      <a href="#/minha-conta?aba=pedidos" data-nav-link style="${linkStyle}">Meus Pedidos</a>
      <button type="button" id="mobile-logout-btn" class="btn-link" style="padding:14px 0;font-size:15px;">Sair da conta</button>
    </div>`;
  }
  return `
  <div style="padding:0 20px;">
    <a href="#/login" data-nav-link style="${linkStyle}">Entrar</a>
    <a href="#/atacado" data-nav-link style="${linkStyle}">Comprar no Atacado</a>
  </div>`;
}

export function bindHeaderEvents() {
  const hamburger = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  hamburger?.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.hidden = !isOpen;
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      if (mobileMenu) mobileMenu.hidden = true;
    });
  });

  const searchForm = document.getElementById('search-form');
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    navigate(`/produtos${q ? `?busca=${encodeURIComponent(q)}` : ''}`);
  });

  const mobileSearchForm = document.getElementById('mobile-search-form');
  mobileSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('mobile-search-input').value.trim();
    mobileMenu.hidden = true;
    hamburger?.classList.remove('open');
    navigate(`/produtos${q ? `?busca=${encodeURIComponent(q)}` : ''}`);
  });

  document.getElementById('cart-btn')?.addEventListener('click', openCartDrawer);

  bindAccountAreaEvents();
  updateActiveNav();
}

function bindAccountAreaEvents() {
  const hamburger = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  const trigger = document.getElementById('account-trigger');
  const menu = document.getElementById('account-menu');
  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.hidden;
    menu.hidden = !isOpen;
    trigger.setAttribute('aria-expanded', String(isOpen));
  });
  menu?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => { menu.hidden = true; trigger?.setAttribute('aria-expanded', 'false'); });
  });

  document.getElementById('account-logout-btn')?.addEventListener('click', () => {
    logout();
    showToast('Você saiu da sua conta.', 'info');
    navigate('/');
  });
  document.getElementById('mobile-logout-btn')?.addEventListener('click', () => {
    logout();
    showToast('Você saiu da sua conta.', 'info');
    hamburger?.classList.remove('open');
    if (mobileMenu) mobileMenu.hidden = true;
    navigate('/');
  });

  document.querySelectorAll('#mobile-account-links [data-nav-link]').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      if (mobileMenu) mobileMenu.hidden = true;
    });
  });
}

document.addEventListener('click', (e) => {
  const widget = document.querySelector('.account-widget');
  const menu = document.getElementById('account-menu');
  if (!menu || menu.hidden) return;
  if (widget && !widget.contains(e.target)) {
    menu.hidden = true;
    document.getElementById('account-trigger')?.setAttribute('aria-expanded', 'false');
  }
});

function refreshAccountArea() {
  const user = getCurrentUser();
  const headerAccount = document.getElementById('header-account');
  const mobileAccountLinks = document.getElementById('mobile-account-links');
  if (headerAccount) headerAccount.innerHTML = renderAccountArea(user);
  if (mobileAccountLinks) mobileAccountLinks.innerHTML = renderMobileAccountLinks(user);
  bindAccountAreaEvents();
}

export function updateActiveNav() {
  const hash = location.hash.replace('#', '') || '/';
  const [path, queryStr] = hash.split('?');
  const query = new URLSearchParams(queryStr || '');
  document.querySelectorAll('[data-nav-link]').forEach((a) => {
    const href = a.getAttribute('href').replace('#', '');
    const [linkPath, linkQueryStr] = href.split('?');
    const linkQuery = new URLSearchParams(linkQueryStr || '');
    let active = linkPath === path;
    if (active && linkPath === '/produtos') {
      active = (linkQuery.get('categoria') || '') === (query.get('categoria') || '')
        && (linkQuery.get('tag') || '') === (query.get('tag') || '');
    }
    a.classList.toggle('active', active);
  });
}

export function updateHeaderBadges() {
  const cartBadge = document.getElementById('cart-count');
  const favBadge = document.getElementById('fav-count');
  if (cartBadge) {
    const count = getCount();
    cartBadge.textContent = String(count);
    cartBadge.hidden = count === 0;
  }
  if (favBadge) {
    const count = getFavoritesCount();
    favBadge.textContent = String(count);
    favBadge.hidden = count === 0;
  }
}

window.addEventListener('cart:change', updateHeaderBadges);
window.addEventListener('favorites:change', updateHeaderBadges);
window.addEventListener('auth:change', refreshAccountArea);
