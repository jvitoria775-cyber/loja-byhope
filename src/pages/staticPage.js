const CONTENT = {
  'politica-privacidade': {
    title: 'Política de Privacidade',
    body: `
      <p>A GRATITUDE TÊXTIL respeita a sua privacidade. Os dados fornecidos em nosso site (como nome, e-mail, endereço e telefone) são utilizados exclusivamente para processar pedidos, melhorar sua experiência de compra e enviar comunicações que você tenha autorizado.</p>
      <p>Não compartilhamos seus dados pessoais com terceiros para fins de marketing sem o seu consentimento. Todas as informações são armazenadas com práticas de segurança adequadas.</p>
      <p>Você pode solicitar a exclusão ou correção dos seus dados a qualquer momento através do nosso canal de contato.</p>`,
  },
  'termos-uso': {
    title: 'Termos de Uso',
    body: `
      <p>Ao utilizar o site da GRATITUDE TÊXTIL, você concorda com os presentes Termos de Uso. Todo o conteúdo (textos, imagens, logotipo) é de propriedade da GRATITUDE TÊXTIL e não pode ser reproduzido sem autorização.</p>
      <p>Os preços e a disponibilidade dos produtos estão sujeitos a alteração sem aviso prévio. Reservamo-nos o direito de recusar ou cancelar pedidos em casos de indícios de fraude.</p>
      <p>Este é um ambiente de demonstração técnica: nenhum pagamento real é processado através deste site.</p>`,
  },
  'trocas-devolucoes': {
    title: 'Trocas e Devoluções',
    body: `
      <p>Você tem até <strong>30 dias corridos</strong> após o recebimento do pedido para solicitar troca ou devolução, desde que o produto esteja em perfeito estado, sem sinais de uso e com as etiquetas originais.</p>
      <p>Para iniciar uma troca ou devolução, entre em contato pelo nosso <a href="#/contato">canal de atendimento</a> informando o número do seu pedido.</p>
      <p>O reembolso é processado em até 10 dias úteis após o recebimento e conferência do produto devolvido.</p>`,
  },
  'frete-entrega': {
    title: 'Frete e Entrega',
    body: `
      <p>Entregamos para todo o Brasil. O prazo de entrega varia conforme a região e a modalidade escolhida (econômico ou expresso), podendo levar de 2 a 12 dias úteis.</p>
      <p>Você pode simular o valor e o prazo do frete diretamente na página do carrinho, informando o seu CEP.</p>`,
  },
};

export function render(params) {
  const key = params[0];
  const page = CONTENT[key];
  if (!page) {
    return `<div class="empty-state"><h3>Página não encontrada.</h3><a href="#/" class="btn btn-outline">Voltar ao início</a></div>`;
  }
  return `
  <div class="page-header">
    <div class="container">
      <div class="breadcrumbs"><a href="#/">Início</a> &rsaquo; <span>${page.title}</span></div>
      <h1>${page.title}</h1>
    </div>
  </div>
  <div class="container" style="max-width:800px;padding-bottom:100px;line-height:1.9;color:var(--color-text-soft);">
    ${page.body}
  </div>`;
}

export function afterRender(params) {
  const page = CONTENT[params[0]];
  document.title = `${page ? page.title : 'GRATITUDE TÊXTIL'} | GRATITUDE TÊXTIL`;
}
