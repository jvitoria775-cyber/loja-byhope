import { icon } from './icons.js';
import { getCount } from '../context/cartStore.js';
import { getFavoritesCount } from '../context/favoritesStore.js';
import { getCurrentUser } from '../context/authStore.js';
import { openCartDrawer } from './cartDrawer.js';
import { navigate } from '../router.js';

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
      <div class="header-actions">
        <a href="#/login" class="icon-btn" id="account-btn" aria-label="${user ? 'Minha conta, ' + user.name : 'Entrar ou cadastrar'}" title="${user ? user.name : 'Entrar'}">
          ${icon('user')}
        </a>
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
      <nav aria-label="Menu principal mobile" style="display:flex;flex-direction:column;padding:0 20px 24px;">
        ${NAV_ITEMS.map((item) => `<a href="${item.href}" data-nav-link style="padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:15px;">${item.label}</a>`).join('')}
        <a href="#/sobre" style="padding:14px 0;border-bottom:1px solid var(--color-border-soft);font-size:15px;">Sobre nós</a>
        <a href="#/contato" style="padding:14px 0;font-size:15px;">Contato</a>
      </nav>
    </div>
  </header>`;
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

  updateActiveNav();
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
  const accountBtn = document.getElementById('account-btn');
  if (accountBtn) {
    const user = getCurrentUser();
    accountBtn.setAttribute('title', user ? user.name : 'Entrar');
  }
}

window.addEventListener('cart:change', updateHeaderBadges);
window.addEventListener('favorites:change', updateHeaderBadges);
window.addEventListener('auth:change', updateHeaderBadges);
