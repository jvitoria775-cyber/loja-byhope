import { getCatalogProducts } from '../services/catalogService.js';
import { getFavorites } from '../context/favoritesStore.js';
import { renderProductGrid } from '../components/productCard.js';
import { icon } from '../components/icons.js';
import { bindGridInteractions } from './pageUtils.js';

export function render() {
  const favIds = getFavorites();
  const favProducts = getCatalogProducts().filter((p) => favIds.includes(p.id));

  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs"><a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')} <span>Favoritos</span></div>
      <h1>Meus Favoritos</h1>
      <p class="result-count">${favProducts.length ? `${favProducts.length} produto${favProducts.length > 1 ? 's' : ''} salvo${favProducts.length > 1 ? 's' : ''}` : ''}</p>
    </div>
  </div>
  <div class="container favorites-grid">
    ${favProducts.length ? renderProductGrid(favProducts) : `
      <div class="page-empty">
        <div class="icon-circle">${icon('heart', 'icon')}</div>
        <h2>Sua lista de favoritos está vazia</h2>
        <p>Toque no coração dos produtos que você amar para salvá-los aqui.</p>
        <a href="#/produtos" class="btn btn-primary">Explorar produtos</a>
      </div>`}
  </div>`;
}

export function afterRender() {
  document.title = 'Favoritos | GRATITUDE TÊXTIL';
  bindGridInteractions(document.getElementById('app'));

  window.addEventListener('favorites:change', rerenderIfOnPage);
}

function rerenderIfOnPage() {
  if (location.hash.replace('#', '').split('?')[0] !== '/favoritos') {
    window.removeEventListener('favorites:change', rerenderIfOnPage);
    return;
  }
  const app = document.getElementById('app');
  app.innerHTML = render();
  bindGridInteractions(app);
}
