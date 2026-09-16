import { icon } from './icons.js';

export function renderFooter() {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="#/" class="logo"><img src="/public/brand/logo-header.png" alt="Gratitude Têxtil" style="filter:brightness(1.1);"></a>
          <p>Confecção têxtil de peças básicas em atacado: camisetas, baby look, cropped, regata, moletom e shorts — qualidade e conforto para vestir com gratidão.</p>
        </div>
        <div class="footer-col">
          <h4>Institucional</h4>
          <ul>
            <li><a href="#/sobre">Sobre nós</a></li>
            <li><a href="#/contato">Contato</a></li>
            <li><a href="#/politica-privacidade">Política de privacidade</a></li>
            <li><a href="#/termos-uso">Termos de uso</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Atendimento</h4>
          <ul>
            <li><a href="#/contato">Central de ajuda</a></li>
            <li><a href="#/trocas-devolucoes">Trocas e devoluções</a></li>
            <li><a href="#/frete-entrega">Frete e entrega</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Categorias</h4>
          <ul>
            <li><a href="#/produtos?categoria=camiseta">Camisetas</a></li>
            <li><a href="#/produtos?categoria=babylook">Baby Look</a></li>
            <li><a href="#/produtos?categoria=cropped">Cropped</a></li>
            <li><a href="#/produtos?categoria=regata">Regata</a></li>
            <li><a href="#/produtos?categoria=moletom">Moletom</a></li>
            <li><a href="#/produtos?categoria=short">Shorts</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Minha conta</h4>
          <ul>
            <li><a href="#/login">Entrar</a></li>
            <li><a href="#/cadastro">Criar conta</a></li>
            <li><a href="#/favoritos">Favoritos</a></li>
            <li><a href="#/carrinho">Carrinho</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} Gratitude Têxtil. Todos os direitos reservados.</span>
        <div class="payment-icons">
          <span>Visa</span><span>Mastercard</span><span>Elo</span><span>Pix</span><span>Boleto</span>
        </div>
        <div class="security-note">${icon('lock', 'icon icon-sm')} Compra 100% segura</div>
      </div>
    </div>
  </footer>`;
}
