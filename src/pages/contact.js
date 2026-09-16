import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

export function render() {
  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs"><a href="#/">Início</a> ${icon('chevronRight', 'icon icon-sm')} <span>Contato</span></div>
      <h1>Fale com a gente</h1>
      <p class="result-count">Estamos aqui para ajudar com dúvidas, trocas ou sugestões.</p>
    </div>
  </div>

  <div class="container contact-layout">
    <div>
      <div class="checkout-section">
        <h3>Envie uma mensagem</h3>
        <form id="contact-form">
          <div class="form-grid">
            <div class="form-field"><label for="c-name">Nome</label><input id="c-name" name="name" type="text" required /></div>
            <div class="form-field"><label for="c-email">E-mail</label><input id="c-email" name="email" type="email" required /></div>
            <div class="form-field"><label for="c-phone">Telefone</label><input id="c-phone" name="phone" type="tel" placeholder="(00) 00000-0000" /></div>
            <div class="form-field">
              <label for="c-subject">Assunto</label>
              <select id="c-subject" name="subject" required>
                <option value="">Selecione</option>
                <option>Dúvida sobre pedido</option>
                <option>Trocas e devoluções</option>
                <option>Vendas no atacado</option>
                <option>Sugestão</option>
                <option>Outro</option>
              </select>
            </div>
            <div class="form-field full">
              <label for="c-message">Mensagem</label>
              <textarea id="c-message" name="message" rows="5" required placeholder="Como podemos ajudar?"></textarea>
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Enviar mensagem</button>
        </form>
      </div>
    </div>

    <div>
      <div class="contact-info-card">
        <div class="contact-info-item">
          <div class="icon-circle">${icon('mail', 'icon')}</div>
          <div><strong>E-mail</strong><span>Responderemos pelo e-mail informado no formulário</span></div>
        </div>
        <div class="contact-info-item">
          <div class="icon-circle">${icon('package', 'icon')}</div>
          <div><strong>Sobre a Gratitude Têxtil</strong><span>Camisetas, baby look, cropped, regata, moletom e shorts em atacado</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

export function afterRender() {
  document.title = 'Contato | GRATITUDE TÊXTIL';
  document.getElementById('contact-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Mensagem enviada! Retornaremos em breve.', 'success');
    e.target.reset();
  });
}
