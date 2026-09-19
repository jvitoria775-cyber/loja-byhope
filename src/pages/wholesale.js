import { getCurrentUser } from '../context/authStore.js';
import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/dom.js';

const BENEFITS = [
  { icon: 'dollarSign', title: 'Preços exclusivos de atacado', text: 'Desbloqueie a tabela de preços especial para lojistas assim que sua conta for criada.' },
  { icon: 'package', title: 'Pedido mínimo de apenas 5 peças', text: 'Combine cores, tamanhos e modelos como quiser — o mínimo é só a quantidade total.' },
  { icon: 'users', title: 'Cadastro pessoa física ou jurídica', text: 'Aceitamos CPF ou CNPJ — não é preciso ter empresa aberta para comprar no atacado.' },
  { icon: 'truck', title: 'Acompanhamento dos seus pedidos', text: 'Veja o histórico completo e o preço pago em cada pedido na sua área de cliente.' },
];

export function render() {
  const user = getCurrentUser();

  return `
  <div class="container" style="max-width:880px;margin:60px auto 100px;padding:0 20px;text-align:center;">
    <span class="wholesale-badge">${icon('store', 'icon icon-sm')} Para lojistas e revendedores</span>
    <h1 style="font-size:34px;margin:18px 0 12px;">Compre no atacado com a Gratitude Têxtil</h1>
    <p class="section-sub" style="max-width:560px;margin:0 auto 30px;">Crie sua conta gratuita de cliente atacadista e tenha acesso aos preços exclusivos para revenda em todo o nosso catálogo.</p>

    ${user
      ? `<a href="#/produtos" class="btn btn-primary" style="padding:16px 34px;">Ver produtos com preço de atacado</a>`
      : `<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
          <a href="#/cadastro" class="btn btn-primary" style="padding:16px 34px;">Quero comprar no atacado</a>
          <a href="#/login" class="btn btn-outline" style="padding:16px 34px;">Já tenho conta</a>
        </div>`}

    <span class="wholesale-badge" style="margin-top:18px;">${icon('package', 'icon icon-sm')} Pedido mínimo de 5 peças — combine cores, tamanhos e modelos à vontade</span>

    <div class="strip-grid" style="margin-top:64px;text-align:center;">
      ${BENEFITS.map((b) => `
        <div class="strip-item">
          <div class="icon-circle">${icon(b.icon, 'icon')}</div>
          <h4 style="margin:14px 0 6px;font-size:15px;">${escapeHtml(b.title)}</h4>
          <p style="font-size:13.5px;color:var(--color-text-soft);">${escapeHtml(b.text)}</p>
        </div>`).join('')}
    </div>
  </div>`;
}

export function afterRender() {
  document.title = 'Comprar no Atacado | GRATITUDE TÊXTIL';
}
