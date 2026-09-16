import { products } from '../data/products.js';
import { getCatalogProducts } from '../services/catalogService.js';
import { renderVariantGrid } from '../components/productCard.js';
import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/dom.js';
import { bindGridInteractions } from './pageUtils.js';

function heroImg() {
  return '/public/products/camiseta/preta-1.jpg';
}

const CATEGORY_CARDS = [
  { key: 'camiseta', label: 'Camisetas', href: '/produtos?categoria=camiseta' },
  { key: 'babylook', label: 'Baby Look', href: '/produtos?categoria=babylook' },
  { key: 'moletom', label: 'Moletom', href: '/produtos?categoria=moletom' },
  { key: 'cropped', label: 'Cropped', href: '/produtos?categoria=cropped' },
  { key: 'regata', label: 'Regata', href: '/produtos?categoria=regata' },
  { key: 'short', label: 'Shorts', href: '/produtos?categoria=short' },
];

export async function render() {
  const featured = await getCatalogProducts();

  return `
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <span class="eyebrow">Gratitude Têxtil</span>
        <h1>Conforto e qualidade em cada peça.</h1>
        <p>Camisetas, baby look, cropped, regata, moletom e shorts — peças básicas de alta qualidade, direto da confecção para você.</p>
        <div class="hero-actions">
          <a href="#/produtos" class="btn btn-primary">Ver produtos</a>
          <a href="#/sobre" class="btn btn-outline">Conheça a marca</a>
        </div>
      </div>
      <div class="hero-media">
        <div class="media"><img src="${heroImg()}" alt="Camiseta básica Gratitude Têxtil" onerror="window.__imgErr(this)"><div class="media-fallback"><span>GT</span></div></div>
        <div class="hero-badge"><strong>6 categorias</strong><span>Camisetas, moletom e mais, em várias cores</span></div>
      </div>
    </div>
  </section>

  <section class="categories-section container">
    <div class="section-head">
      <span class="eyebrow">Explore</span>
      <h2 class="section-title">Categorias</h2>
      <p class="section-sub" style="margin:0 auto;">Encontre a peça certa para o seu momento.</p>
    </div>
    <div class="category-grid">
      ${CATEGORY_CARDS.map((c) => categoryCard(c)).join('')}
    </div>
  </section>

  <section class="products-section container">
    <div class="section-head">
      <span class="eyebrow">Catálogo</span>
      <h2 class="section-title">Nossos Produtos</h2>
      <p class="section-sub" style="margin:0 auto;">Peças básicas para o dia a dia, com várias cores disponíveis em cada modelo.</p>
    </div>
    ${renderVariantGrid(featured).html}
  </section>

  <section class="editorial">
    <div class="container">
      <div class="editorial-media">
        <div class="media"><img src="/public/products/moletom/preto-1.jpg" alt="Moletom canguru Gratitude Têxtil" onerror="window.__imgErr(this)"><div class="media-fallback"><span>GT</span></div></div>
      </div>
      <div class="editorial-text">
        <span class="eyebrow">Feito com cuidado</span>
        <h2 class="section-title">Peças básicas, com atenção aos detalhes</h2>
        <p>Trabalhamos com tecidos selecionados — meia malha 100% algodão nas camisetas, baby look, cropped e regatas, moletom peluciado nos canguru e Tectel nos shorts — para garantir conforto, caimento e durabilidade em cada peça.</p>
        <a href="#/produtos" class="btn btn-primary">Ver catálogo completo</a>
      </div>
    </div>
  </section>

  <section class="strip-banner">
    <div class="container strip-grid">
      <div class="strip-item">
        <div class="icon-circle">${icon('truck', 'icon')}</div>
        <h4>Entrega para todo o Brasil</h4>
        <p>Calcule o frete na página do carrinho</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('refresh', 'icon')}</div>
        <h4>Troca fácil</h4>
        <p>Até 30 dias para trocar ou devolver</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('shield', 'icon')}</div>
        <h4>Compra segura</h4>
        <p>Seus dados sempre protegidos</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('creditCard', 'icon')}</div>
        <h4>Parcele sem juros</h4>
        <p>Em até 3x no cartão de crédito</p>
      </div>
    </div>
  </section>

  <section class="newsletter">
    <div class="container">
      <h2>Fique por dentro das novidades</h2>
      <p>Cadastre seu e-mail para receber novidades da coleção Gratitude Têxtil.</p>
      <form class="newsletter-form" id="newsletter-form">
        <input type="email" required placeholder="Seu melhor e-mail" aria-label="E-mail para novidades" />
        <button class="btn btn-accent" type="submit">Cadastrar</button>
      </form>
    </div>
  </section>
  `;
}

function categoryCard(c) {
  const product = products.find((p) => p.category === c.key);
  const img = product ? product.images[0].src : '';
  const colorCount = product ? product.colors.length : 0;
  return `
    <a class="category-card" href="#${c.href}">
      <div class="media">
        <img src="${img}" alt="${escapeHtml(c.label)}" onerror="window.__imgErr(this)">
        <div class="media-fallback"><span>GT</span></div>
      </div>
      <div class="category-card-label">
        <h3>${escapeHtml(c.label)}</h3>
        <span>${colorCount} cores disponíveis ${icon('arrowRight', 'icon icon-sm')}</span>
      </div>
    </a>`;
}

export function afterRender() {
  bindGridInteractions(document.getElementById('app'));
  document.title = 'Gratitude Têxtil — Camisetas, Moletons e Peças Básicas em Atacado';

  const form = document.getElementById('newsletter-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    import('../components/toast.js').then(({ showToast }) => {
      showToast('Obrigado por se inscrever! Você receberá nossas novidades por e-mail.', 'success');
    });
    form.reset();
  });
}
