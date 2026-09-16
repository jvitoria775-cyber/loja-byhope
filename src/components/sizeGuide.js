import { openModal } from './modal.js';
import { escapeHtml } from '../utils/dom.js';

export function openSizeGuide(product) {
  const img = product?.sizeChartImage;
  openModal(`
    <h3>Guia de Tamanhos</h3>
    <p class="modal-sub">Tabela de medidas oficial — ${escapeHtml(product?.categoryLabel || 'produto')}.</p>
    ${img
      ? `<img src="${img}" alt="Tabela de medidas - ${escapeHtml(product?.name || '')}" style="width:100%;border-radius:10px;margin-top:10px;" onerror="window.__imgErr && window.__imgErr(this)">`
      : `<p>Guia de tamanhos indisponível para este produto.</p>`}
    <p class="form-hint" style="margin-top:14px;">As medidas podem variar até 2 cm. Em caso de dúvida entre dois tamanhos, recomendamos escolher o maior.</p>
  `);
}
