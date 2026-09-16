import './utils/dom.js';
import { renderHeader, bindHeaderEvents } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { initRouter } from './router.js';

function mount() {
  document.getElementById('header-root').innerHTML = renderHeader();
  document.getElementById('footer-root').innerHTML = renderFooter();
  bindHeaderEvents();
  initRouter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
