import { getCatalogProducts } from '../services/catalogService.js';
import { toggleFavorite } from '../context/favoritesStore.js';
import { addItem } from '../context/cartStore.js';
import { showToast } from '../components/toast.js';
import { icon } from '../components/icons.js';

export function bindGridInteractions(container) {
  if (!container) return;

  container.querySelectorAll('[data-fav-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-fav-btn');
      const nowFav = toggleFavorite(id);
      btn.classList.toggle('active', nowFav);
      btn.setAttribute('aria-pressed', String(nowFav));
      btn.innerHTML = icon('heart');
      showToast(nowFav ? 'Adicionado aos favoritos' : 'Removido dos favoritos', nowFav ? 'success' : 'info', 2000);
    });
  });

  container.querySelectorAll('[data-quick-add]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-quick-add');
      const product = (await getCatalogProducts()).find((p) => p.id === id);
      if (!product) return;

      const colorSlug = btn.getAttribute('data-quick-add-color');
      const colorObj = product.colors.find((c) => c.slug === colorSlug) || product.colors[0];
      const color = colorObj.name;

      const stockForColor = product.stockByColorSize?.[colorObj.slug] || {};
      const size = product.sizes.find((s) => stockForColor[s] > 0);
      if (!size) {
        showToast('Produto sem estoque disponível no momento.', 'error');
        return;
      }
      addItem(product, size, color, 1);
      showToast(`${product.name} adicionado ao carrinho (Tam. ${size} / ${color})`, 'success');
    });
  });
}
