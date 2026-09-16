// Camada de dados compartilhada entre as telas do painel (Visão Geral,
// Pedidos, Clientes, Financeiro) e o PDV. Continua usando localStorage
// (mesmo mecanismo da loja) - por isso só enxerga pedidos feitos NESTE
// navegador/computador. Para múltiplos caixas/dispositivos compartilharem
// os mesmos pedidos, seria necessário um backend real com banco de dados.
import { getItem, setItem } from '../utils/storage.js';

const ORDER_PREFIX = 'amara:order:';

// Etapas possíveis do ciclo de vida de um pedido, na ordem em que
// normalmente acontecem. Usado tanto para os filtros rápidos quanto para
// os botões de ação na tela de detalhes.
export const FULFILLMENT_STEPS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'em separação', label: 'Em separação' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function getAllOrders() {
  const orders = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ORDER_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        const order = JSON.parse(raw);
        if (order && order.id) {
          normalizeOrder(order);
          orders.push(order);
        }
      } catch { /* item corrompido, ignora */ }
    }
  }
  orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  return orders;
}

// Pedidos criados antes desta expansão do painel não têm todos os campos
// novos (fulfillmentStatus, statusHistory, trackingCode) - preenchemos com
// valores padrão coerentes para não quebrar a interface.
function normalizeOrder(order) {
  if (!order.channel) order.channel = 'online';
  if (!order.fulfillmentStatus) {
    order.fulfillmentStatus = order.payment?.status === 'pago' ? 'pago' : order.payment?.status === 'cancelado' ? 'cancelado' : 'pendente';
  }
  if (!Array.isArray(order.statusHistory) || !order.statusHistory.length) {
    order.statusHistory = [{ status: order.fulfillmentStatus, date: order.date }];
  }
  if (typeof order.trackingCode !== 'string') order.trackingCode = '';
  return order;
}

export function getOrder(id) {
  const order = getItem(`order:${id}`, null);
  return order ? normalizeOrder(order) : null;
}

export function saveOrder(order) {
  setItem(`order:${order.id}`, order);
}

export function updateOrderStatus(id, status) {
  const order = getOrder(id);
  if (!order) return null;
  order.payment = order.payment || {};
  order.payment.status = status;
  saveOrder(order);
  return order;
}

// Avança/ajusta a etapa de separação-envio do pedido, registrando no
// histórico para exibir a linha do tempo na tela de detalhes.
export function updateFulfillmentStatus(id, status) {
  const order = getOrder(id);
  if (!order) return null;
  order.fulfillmentStatus = status;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({ status, date: new Date().toISOString() });
  if (status === 'pago' && order.payment) order.payment.status = 'pago';
  if (status === 'cancelado' && order.payment) order.payment.status = 'cancelado';
  saveOrder(order);
  return order;
}

export function updateTrackingCode(id, trackingCode) {
  const order = getOrder(id);
  if (!order) return null;
  order.trackingCode = trackingCode;
  saveOrder(order);
  return order;
}

export function generatePdvOrderId() {
  return `PDV${Date.now().toString().slice(-8)}`;
}

export function computeStats(orders) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const paidOrders = orders.filter((o) => o.payment?.status === 'pago');
  const todayOrders = orders.filter((o) => new Date(o.date) >= today);
  const monthPaid = paidOrders.filter((o) => new Date(o.date) >= monthStart);
  const revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const monthRevenue = monthPaid.reduce((sum, o) => sum + (o.total || 0), 0);
  const onlineCount = orders.filter((o) => o.channel === 'online').length;
  const pdvCount = orders.filter((o) => o.channel === 'pdv').length;

  return {
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    pendingOrders: orders.length - paidOrders.length,
    todayOrders: todayOrders.length,
    revenue,
    monthRevenue,
    avgTicket: paidOrders.length ? revenue / paidOrders.length : 0,
    onlineCount,
    pdvCount,
  };
}
