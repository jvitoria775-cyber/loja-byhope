import * as overview from './pages/overview.js';
import * as orders from './pages/orders.js';
import * as customers from './pages/customers.js';
import * as productsPage from './pages/products.js';
import * as finance from './pages/finance.js';
import * as settings from './pages/settings.js';
import { renderShell, bindShellEvents } from './shell.js';

const routes = [
  { path: /^$/, key: 'overview', title: 'Visão Geral', subtitle: 'Resumo do desempenho da loja.', page: overview },
  { path: /^pedidos$/, key: 'pedidos', title: 'Pedidos', subtitle: 'Gestão de vendas e pedidos.', page: orders },
  { path: /^clientes$/, key: 'clientes', title: 'Clientes', subtitle: 'Base de clientes (CRM).', page: customers },
  { path: /^produtos$/, key: 'produtos', title: 'Produtos & Estoque', subtitle: 'Catálogo e controle de estoque.', page: productsPage },
  { path: /^financeiro$/, key: 'financeiro', title: 'Financeiro & Relatórios', subtitle: 'Receitas, custos e lucro estimado.', page: finance },
  { path: /^configuracoes$/, key: 'configuracoes', title: 'Configurações', subtitle: 'Dados da loja, integrações e segurança.', page: settings },
];

export function navigate(path) {
  if (location.hash === '#' + path) render();
  else location.hash = '#' + path;
}

export function initAdminRouter() {
  window.addEventListener('hashchange', render);
  render();
}

function parseHash() {
  const raw = (location.hash.slice(1) || '').replace(/^\//, '');
  return raw;
}

async function render() {
  const path = parseHash();
  const match = routes.find((r) => r.path.test(path)) || routes[0];

  const root = document.getElementById('app-root');
  root.innerHTML = renderShell({ active: match.key, title: match.title, subtitle: match.subtitle, content: '<div id="page-content"></div>' });
  bindShellEvents();

  const contentEl = document.getElementById('page-content');
  try {
    contentEl.innerHTML = await match.page.render();
    await match.page.afterRender?.();
  } catch (err) {
    console.error('Erro ao renderizar página do painel:', err);
    contentEl.innerHTML = `<div class="empty-note"><strong>Ocorreu um erro ao carregar esta seção.</strong></div>`;
  }
}
