import { icon } from '../components/icons.js';

export function render() {
  return `
  <div class="page-banner">
    <div class="media"><img src="/public/products/moletom/marinho-1.jpg" alt="Moletom Gratitude Têxtil" onerror="window.__imgErr(this)"><div class="media-fallback"><span>GT</span></div></div>
    <div class="page-banner-content container">
      <span class="eyebrow" style="color:#E3C9BC;">Gratitude Têxtil</span>
      <h1>Peças básicas, feitas para o seu dia a dia</h1>
    </div>
  </div>

  <section class="editorial">
    <div class="container">
      <div class="editorial-media">
        <div class="media"><img src="/public/products/camiseta/branca-1.jpg" alt="Camiseta básica Gratitude Têxtil" onerror="window.__imgErr(this)"><div class="media-fallback"><span>GT</span></div></div>
      </div>
      <div class="editorial-text">
        <span class="eyebrow">Quem somos</span>
        <h2 class="section-title">Confecção têxtil focada em peças básicas de qualidade</h2>
        <p>A Gratitude Têxtil produz peças básicas para o guarda-roupa do dia a dia: camisetas, baby look, cropped, regata, moletom canguru e shorts, em tecidos selecionados e com atenção aos detalhes de acabamento.</p>
        <p>Trabalhamos com meia malha 100% algodão nas camisetas, baby look, cropped e regatas, moletom peluciado nos canguru e tecido Tectel nos shorts — sempre buscando o equilíbrio entre conforto, durabilidade e um preço justo.</p>
      </div>
    </div>
  </section>

  <section class="about-section container">
    <div class="section-head">
      <span class="eyebrow">O que nos guia</span>
      <h2 class="section-title">Nossos valores</h2>
    </div>
    <div class="values-grid">
      <div class="value-card">
        <div class="icon-circle">${icon('leaf', 'icon')}</div>
        <h4>Conforto real</h4>
        <p>Tecidos selecionados para o uso diário, com caimento e maciez em cada peça.</p>
      </div>
      <div class="value-card">
        <div class="icon-circle">${icon('award', 'icon')}</div>
        <h4>Qualidade têxtil</h4>
        <p>Costuras reforçadas e acabamento cuidadoso em toda a linha de produtos.</p>
      </div>
      <div class="value-card">
        <div class="icon-circle">${icon('sparkle', 'icon')}</div>
        <h4>Preço justo</h4>
        <p>Peças básicas com preço acessível, direto da confecção para você.</p>
      </div>
    </div>
  </section>

  <section class="strip-banner">
    <div class="container strip-grid">
      <div class="strip-item">
        <div class="icon-circle">${icon('truck', 'icon')}</div>
        <h4>Entrega para todo o Brasil</h4>
        <p>Frete calculado por CEP no carrinho</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('refresh', 'icon')}</div>
        <h4>Trocas e devoluções</h4>
        <p>Até 30 dias após o recebimento</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('leaf', 'icon')}</div>
        <h4>Tecidos selecionados</h4>
        <p>Algodão, moletom peluciado e Tectel</p>
      </div>
      <div class="strip-item">
        <div class="icon-circle">${icon('heart', 'icon')}</div>
        <h4>Feito para todos</h4>
        <p>Peças femininas, masculinas e unissex</p>
      </div>
    </div>
  </section>`;
}

export function afterRender() {
  document.title = 'Sobre Nós | GRATITUDE TÊXTIL';
}
