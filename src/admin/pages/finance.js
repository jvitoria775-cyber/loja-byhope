import { getAllOrders } from '../orderStore.js';
import { PRODUCT_COSTS } from '../productAdminStore.js';
import { products as catalogProducts } from '../../data/products.js';
import { renderBarList } from '../charts.js';
import { formatBRL, formatDate } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

// Alíquotas estimadas para a demonstração do painel: 10% de imposto (regime
// Simples Nacional, faixa inicial para comércio) + 6% de taxa média de
// pagamento (cartão/Pix via Pagar.me). Ambas são estimativas para fins de
// relatório interno, não um cálculo fiscal oficial.
const TAX_RATE = 0.10;
const PAYMENT_FEE_RATE = 0.06;

const CATEGORY_BY_PRODUCT_ID = new Map(catalogProducts.map((p) => [p.id, p.category]));

let state = { period: '7d', from: '', to: '' };
let allOrders = [];

function getRange() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start;

  if (state.period === '7d') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (state.period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (state.period === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    lastDayPrevMonth.setHours(23, 59, 59, 999);
    return { start, end: lastDayPrevMonth };
  } else if (state.period === 'custom' && state.from && state.to) {
    start = new Date(state.from);
    start.setHours(0, 0, 0, 0);
    const customEnd = new Date(state.to);
    customEnd.setHours(23, 59, 59, 999);
    return { start, end: customEnd };
  } else {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function itemCost(item) {
  const category = CATEGORY_BY_PRODUCT_ID.get(item.id);
  return (PRODUCT_COSTS[category] || 0) * item.qty;
}

function computeFinance(orders) {
  const { start, end } = getRange();
  const inRange = orders.filter((o) => {
    const d = new Date(o.date);
    return d >= start && d <= end && o.payment?.status === 'pago';
  });

  const grossRevenue = inRange.reduce((s, o) => s + (o.total || 0), 0);
  const itemsCost = inRange.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + itemCost(i), 0), 0);
  const tax = grossRevenue * TAX_RATE;
  const paymentFee = grossRevenue * PAYMENT_FEE_RATE;
  const netProfit = grossRevenue - itemsCost - tax - paymentFee;

  const byCategory = new Map();
  inRange.forEach((o) => (o.items || []).forEach((i) => {
    const category = CATEGORY_BY_PRODUCT_ID.get(i.id) || 'outros';
    byCategory.set(category, (byCategory.get(category) || 0) + i.price * i.qty);
  }));
  const categoryRevenue = Array.from(byCategory.entries())
    .map(([label, value]) => ({ label: label[0].toUpperCase() + label.slice(1), value }))
    .sort((a, b) => b.value - a.value);

  return { start, end, orders: inRange, grossRevenue, itemsCost, tax, paymentFee, netProfit, categoryRevenue };
}

export async function render() {
  allOrders = await getAllOrders();
  return `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div class="period-tabs" id="period-tabs">
          <button type="button" data-period="7d" class="${state.period === '7d' ? 'active' : ''}">7 dias</button>
          <button type="button" data-period="month" class="${state.period === 'month' ? 'active' : ''}">Este mês</button>
          <button type="button" data-period="lastMonth" class="${state.period === 'lastMonth' ? 'active' : ''}">Mês anterior</button>
          <button type="button" data-period="custom" class="${state.period === 'custom' ? 'active' : ''}">Personalizado</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-outline btn-sm" id="export-csv-btn">${icon('download', 'icon icon-sm')} Exportar CSV</button>
          <button type="button" class="btn btn-outline btn-sm" id="print-report-btn">${icon('printer', 'icon icon-sm')} Exportar relatório</button>
        </div>
      </div>
      <div id="custom-range-wrap"></div>
    </div>
    <div id="finance-content"></div>
  `;
}

function renderCustomRange() {
  const wrap = document.getElementById('custom-range-wrap');
  if (state.period !== 'custom') { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-end;margin-top:14px;flex-wrap:wrap;">
      <label style="font-size:12px;font-weight:600;">De<input type="date" id="from-date" value="${state.from}" style="display:block;margin-top:4px;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;"></label>
      <label style="font-size:12px;font-weight:600;">Até<input type="date" id="to-date" value="${state.to}" style="display:block;margin-top:4px;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;"></label>
      <button type="button" class="btn btn-primary btn-sm" id="apply-range-btn">Aplicar</button>
    </div>`;
  document.getElementById('from-date').addEventListener('change', (e) => { state.from = e.target.value; });
  document.getElementById('to-date').addEventListener('change', (e) => { state.to = e.target.value; });
  document.getElementById('apply-range-btn').addEventListener('click', () => renderContent());
}

function renderContent() {
  const data = computeFinance(allOrders);
  const el = document.getElementById('finance-content');

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">${icon('trendingUp', 'icon icon-sm')} Receita bruta</div>
        <div class="stat-value">${formatBRL(data.grossRevenue)}</div>
        <div class="stat-sub">${data.orders.length} pedido(s) pago(s) no período</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icon('package', 'icon icon-sm')} Custo dos produtos</div>
        <div class="stat-value">${formatBRL(data.itemsCost)}</div>
        <div class="stat-sub">custo + embalagem/frete por peça</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icon('fileText', 'icon icon-sm')} Impostos estimados</div>
        <div class="stat-value">${formatBRL(data.tax)}</div>
        <div class="stat-sub">${(TAX_RATE * 100).toFixed(0)}% sobre a receita bruta</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icon('creditCard', 'icon icon-sm')} Taxas de pagamento</div>
        <div class="stat-value">${formatBRL(data.paymentFee)}</div>
        <div class="stat-sub">${(PAYMENT_FEE_RATE * 100).toFixed(0)}% sobre a receita bruta</div>
      </div>
      <div class="stat-card ${data.netProfit < 0 ? 'stat-card-warn' : ''}">
        <div class="stat-label">${icon('dollarSign', 'icon icon-sm')} Lucro líquido estimado</div>
        <div class="stat-value">${formatBRL(data.netProfit)}</div>
        <div class="stat-sub">receita - custos - impostos - taxas</div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Receita por categoria</h2>
        ${data.categoryRevenue.length ? renderBarList(data.categoryRevenue, { formatValue: (v) => formatBRL(v) }) : '<p style="color:var(--color-text-soft);">Nenhuma venda no período selecionado.</p>'}
      </div>
      <div class="panel">
        <h2>Resumo do período</h2>
        <div class="detail-row"><span>Período</span><span>${formatDate(data.start)} — ${formatDate(data.end)}</span></div>
        <div class="detail-row"><span>Pedidos pagos</span><span>${data.orders.length}</span></div>
        <div class="detail-row"><span>Ticket médio</span><span>${formatBRL(data.orders.length ? data.grossRevenue / data.orders.length : 0)}</span></div>
        <div class="detail-row"><span>Margem líquida</span><span>${data.grossRevenue ? ((data.netProfit / data.grossRevenue) * 100).toFixed(1) : '0'}%</span></div>
      </div>
    </div>
  `;
}

function downloadCsv() {
  const data = computeFinance(allOrders);
  const header = ['Pedido', 'Data', 'Receita (R$)', 'Custo produtos (R$)', 'Imposto (R$)', 'Taxa pagamento (R$)', 'Lucro (R$)'];
  const rows = data.orders.map((o) => {
    const cost = (o.items || []).reduce((s, i) => s + itemCost(i), 0);
    const tax = o.total * TAX_RATE;
    const fee = o.total * PAYMENT_FEE_RATE;
    const profit = o.total - cost - tax - fee;
    return [o.id, new Date(o.date).toLocaleDateString('pt-BR'), o.total.toFixed(2).replace('.', ','), cost.toFixed(2).replace('.', ','), tax.toFixed(2).replace('.', ','), fee.toFixed(2).replace('.', ','), profit.toFixed(2).replace('.', ',')];
  });
  const csv = '﻿' + [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro-gratitude-textil-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport() {
  const data = computeFinance(allOrders);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório financeiro</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#1A1A1A;}
      h1{font-size:20px;margin-bottom:2px;} p{margin:2px 0;font-size:13px;color:#555;}
      table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;font-size:13px;}
      .total{font-size:16px;font-weight:bold;}
    </style></head><body>
    <h1>Gratitude Têxtil — Relatório Financeiro</h1>
    <p>Período: ${formatDate(data.start)} a ${formatDate(data.end)}</p>
    <table>
      <tr><td>Receita bruta</td><td class="total">${formatBRL(data.grossRevenue)}</td></tr>
      <tr><td>Custo dos produtos</td><td>${formatBRL(data.itemsCost)}</td></tr>
      <tr><td>Impostos estimados (${(TAX_RATE * 100).toFixed(0)}%)</td><td>${formatBRL(data.tax)}</td></tr>
      <tr><td>Taxas de pagamento (${(PAYMENT_FEE_RATE * 100).toFixed(0)}%)</td><td>${formatBRL(data.paymentFee)}</td></tr>
      <tr><td class="total">Lucro líquido estimado</td><td class="total">${formatBRL(data.netProfit)}</td></tr>
    </table>
    <p style="margin-top:16px;">${data.orders.length} pedido(s) pago(s) no período.</p>
    <script>window.onload = () => window.print();</script>
    </body></html>`);
  win.document.close();
}

export async function afterRender() {
  renderCustomRange();
  renderContent();

  document.querySelectorAll('#period-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.period = btn.getAttribute('data-period');
      document.querySelectorAll('#period-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCustomRange();
      renderContent();
    });
  });
  document.getElementById('export-csv-btn').addEventListener('click', downloadCsv);
  document.getElementById('print-report-btn').addEventListener('click', printReport);
}
