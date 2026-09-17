import * as home from './pages/home.js';
import * as catalog from './pages/catalog.js';
import * as product from './pages/product.js';
import * as favorites from './pages/favorites.js';
import * as cartPage from './pages/cart.js';
import * as checkout from './pages/checkout.js';
import * as success from './pages/success.js';
import * as login from './pages/login.js';
import * as register from './pages/register.js';
import * as account from './pages/account.js';
import * as wholesale from './pages/wholesale.js';
import * as about from './pages/about.js';
import * as contact from './pages/contact.js';
import * as staticPage from './pages/staticPage.js';
import * as notFound from './pages/notFound.js';
import { updateActiveNav } from './components/header.js';

const routes = [
  { path: /^\/$/, page: home },
  { path: /^\/produtos$/, page: catalog },
  { path: /^\/produto\/([\w-]+)$/, page: product },
  { path: /^\/favoritos$/, page: favorites },
  { path: /^\/carrinho$/, page: cartPage },
  { path: /^\/checkout$/, page: checkout },
  { path: /^\/pedido\/([\w-]+)$/, page: success },
  { path: /^\/login$/, page: login },
  { path: /^\/redefinir-senha$/, page: login },
  { path: /^\/cadastro$/, page: register },
  { path: /^\/atacado$/, page: wholesale },
  { path: /^\/minha-conta$/, page: account },
  { path: /^\/sobre$/, page: about },
  { path: /^\/contato$/, page: contact },
  { path: /^\/(politica-privacidade|termos-uso|trocas-devolucoes|frete-entrega)$/, page: staticPage },
];

export function navigate(path) {
  if (location.hash === '#' + path) {
    render();
  } else {
    location.hash = '#' + path;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  render();
}

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { path: pathPart || '/', query };
}

async function render() {
  const { path, query } = parseHash();
  const match = routes.find((r) => r.path.test(path));
  const app = document.getElementById('app');
  if (!app) return;

  if (!match) {
    app.innerHTML = notFound.render();
    notFound.afterRender?.();
    finishNav();
    return;
  }

  const params = match.path.exec(path).slice(1);

  try {
    const html = await match.page.render(params, query);
    app.innerHTML = html;
    await match.page.afterRender?.(params, query);
  } catch (err) {
    console.error('Erro ao renderizar página:', err);
    app.innerHTML = `<div class="empty-state"><h3>Ocorreu um erro ao carregar esta página.</h3><p>Tente novamente em instantes.</p><a class="btn btn-outline" href="#/">Voltar ao início</a></div>`;
  }

  finishNav();
}

function finishNav() {
  window.scrollTo(0, 0);
  updateActiveNav();
  document.getElementById('app')?.focus({ preventScroll: true });

  const hamburger = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger?.classList.remove('open');
  hamburger?.setAttribute('aria-expanded', 'false');
  if (mobileMenu) mobileMenu.hidden = true;
}
