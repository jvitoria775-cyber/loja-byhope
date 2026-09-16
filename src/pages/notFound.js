export function render() {
  return `
  <div class="notfound-page">
    <h1>404</h1>
    <h2 style="margin-bottom:12px;">Página não encontrada</h2>
    <p style="color:var(--color-text-soft);margin-bottom:26px;">O endereço que você tentou acessar não existe ou foi movido.</p>
    <a href="#/" class="btn btn-primary">Voltar ao início</a>
  </div>`;
}

export function afterRender() {
  document.title = 'Página não encontrada | GRATITUDE TÊXTIL';
}
