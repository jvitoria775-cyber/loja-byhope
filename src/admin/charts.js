// Gráficos simples desenhados em SVG puro - sem biblioteca externa, para
// manter a mesma arquitetura 100% vanilla JS usada no resto do projeto
// (sem build step, sem dependências via npm).
import { formatBRL } from '../utils/format.js';

// Gráfico de área/linha: recebe um array de {label, value} e desenha uma
// curva suave com preenchimento em degradê dourado.
export function renderAreaChart(points, { height = 220, formatValue = formatBRL } = {}) {
  if (!points.length) return `<p style="color:var(--color-text-faint);padding:30px 0;text-align:center;">Sem dados no período selecionado.</p>`;

  const width = 760;
  const padTop = 20, padBottom = 30, padLeft = 8, padRight = 8;
  const innerH = height - padTop - padBottom;
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const stepX = (width - padLeft - padRight) / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + innerH - (p.value / maxVal) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${padTop + innerH} L ${coords[0].x.toFixed(1)} ${padTop + innerH} Z`;

  const showEvery = Math.ceil(points.length / 8);
  const labels = coords.filter((_, i) => i % showEvery === 0 || i === coords.length - 1);

  return `
  <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none" role="img" aria-label="Gráfico de vendas ao longo do tempo">
    <defs>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.35"></stop>
        <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#areaGradient)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="var(--color-accent-dark)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
    ${coords.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="3" fill="var(--color-accent-dark)"><title>${c.label}: ${formatValue(c.value)}</title></circle>`).join('')}
    ${labels.map((c) => `<text x="${c.x}" y="${height - 8}" font-size="10" fill="var(--color-text-faint)" text-anchor="middle">${c.label}</text>`).join('')}
  </svg>`;
}

// Lista de barras horizontais (ex.: produtos mais vendidos), com largura
// proporcional ao maior valor da lista.
export function renderBarList(items, { formatValue = (v) => String(v) } = {}) {
  if (!items.length) return `<p style="color:var(--color-text-faint);padding:20px 0;">Sem dados suficientes ainda.</p>`;
  const max = Math.max(...items.map((i) => i.value), 1);
  return `
    <div class="bar-list">
      ${items.map((item) => `
        <div class="bar-list-row">
          <div class="bar-list-label">
            ${item.image ? `<img src="${item.image}" alt="" onerror="this.style.visibility='hidden'">` : ''}
            <span>${item.label}</span>
          </div>
          <div class="bar-list-track">
            <div class="bar-list-fill" style="width:${Math.max((item.value / max) * 100, 4)}%;"></div>
          </div>
          <div class="bar-list-value">${formatValue(item.value)}</div>
        </div>`).join('')}
    </div>`;
}

// Agrupa pedidos pagos por dia, dentro de um intervalo, somando o total.
export function groupOrdersByDay(orders, days = 14) {
  const buckets = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: 0 });
  }

  orders.forEach((o) => {
    if (o.payment?.status !== 'pago') return;
    const od = new Date(o.date);
    od.setHours(0, 0, 0, 0);
    const bucket = buckets.find((b) => b.date.getTime() === od.getTime());
    if (bucket) bucket.value += o.total || 0;
  });

  return buckets;
}

export function getTopProducts(orders, limit = 5) {
  const map = new Map();
  orders.forEach((o) => {
    if (o.payment?.status === 'cancelado') return;
    (o.items || []).forEach((item) => {
      const key = item.name;
      const current = map.get(key) || { label: item.name, value: 0, qty: 0, image: item.image };
      current.value += item.price * item.qty;
      current.qty += item.qty;
      map.set(key, current);
    });
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, limit);
}
