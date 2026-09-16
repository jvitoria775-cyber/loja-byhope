import { getAllOrders, computeStats } from '../orderStore.js';
import { getAllCustomers } from '../customerStore.js';
import { getLowStockProducts } from '../productAdminStore.js';
import { renderAreaChart, renderBarList, groupOrdersByDay, getTopProducts } from '../charts.js';
import { formatBRL } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

let period = 14; // dias exibidos no gráfico de vendas

export async function render() {
  const [orders, customers, lowStock] = await Promise.all([getAllOrders(), getAllCustomers(), getLowStockProducts()]);
  const stats = computeStats(orders);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const newCustomers = customers.filter((c) => new Date(c.createdAt) >= thisMonth).length;

  return `
    <div class="stat-grid">
      ${statCard('trendingUp', 'Faturamento total', formatBRL(stats.revenue), `${stats.paidOrders} pedido(s) pago(s)`)}
      ${statCard('calendar', 'Faturamento do mês', formatBRL(stats.monthRevenue), 'mês atual')}
      ${statCard('package', 'Pedidos · Ticket médio', stats.totalOrders, `${formatBRL(stats.avgTicket)} em média`)}
      ${statCard('users', 'Novos clientes', newCustomers, 'cadastrados este mês')}
      ${statCard('alertTriangle', 'Estoque baixo', lowStock.length, 'produto(s) precisam de reposição', lowStock.length > 0)}
    </div>

    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px;">
        <h2 style="margin-bottom:0;">Vendas ao longo do tempo</h2>
        <div class="period-tabs" id="period-tabs">
          <button type="button" data-period="7" class="${period === 7 ? 'active' : ''}">7 dias</button>
          <button type="button" data-period="14" class="${period === 14 ? 'active' : ''}">14 dias</button>
          <button type="button" data-period="30" class="${period === 30 ? 'active' : ''}">30 dias</button>
        </div>
      </div>
      <div id="chart-container">${renderAreaChart(groupOrdersByDay(orders, period))}</div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Produtos mais vendidos</h2>
        ${renderBarList(getTopProducts(orders, 6), { formatValue: (v) => formatBRL(v) })}
      </div>
      <div class="panel">
        <h2>Estoque baixo</h2>
        ${lowStock.length ? `
          <div class="low-stock-list">
            ${lowStock.slice(0, 6).map((p) => `
              <div class="low-stock-row">
                <img src="${p.image}" alt="" onerror="this.style.visibility='hidden'">
                <div style="flex:1;">
                  <strong>${escapeHtml(p.name)}</strong>
                  <span>${escapeHtml(p.sku)}</span>
                </div>
                <span class="badge-pill badge-pendente">${p.totalStock} un.</span>
              </div>`).join('')}
          </div>
          <a href="#produtos" class="btn btn-outline btn-sm btn-block" style="margin-top:14px;">Ver estoque completo</a>
        ` : `<p style="color:var(--color-text-soft);">${icon('checkCircle', 'icon')} Nenhum produto com estoque baixo no momento.</p>`}
      </div>
    </div>
  `;
}

function statCard(iconName, label, value, sub, warn = false) {
  return `
    <div class="stat-card ${warn ? 'stat-card-warn' : ''}">
      <div class="stat-label">${icon(iconName, 'icon icon-sm')} ${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${escapeHtml(sub)}</div>
    </div>`;
}

export async function afterRender() {
  document.querySelectorAll('#period-tabs button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      period = Number(btn.getAttribute('data-period'));
      document.querySelectorAll('#period-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('chart-container').innerHTML = renderAreaChart(groupOrdersByDay(await getAllOrders(), period));
    });
  });
}
