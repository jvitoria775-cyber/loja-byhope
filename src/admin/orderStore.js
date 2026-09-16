// Camada de dados compartilhada entre o Painel de Pedidos e o PDV.
// Continua usando localStorage (mesmo mecanismo da loja) - por isso só
// enxerga pedidos feitos NESTE navegador/computador. Para múltiplos
// caixas/dispositivos verem os mesmos pedidos, seria necessário um
// backend real com banco de dados compartilhado.
import { getItem, setItem } from '../utils/storage.js';

const ORDER_PREFIX = 'amara:order:';

export function getAllOrders() {
  const orders = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ORDER_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        const order = JSON.parse(raw);
        if (order && order.id) {
          if (!order.channel) order.channel = 'online';
          orders.push(order);
        }
      } catch { /* item corrompido, ignora */ }
    }
  }
  orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  return orders;
}

export function getOrder(id) {
  return getItem(`order:${id}`, null);
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

export function updateFulfillmentStatus(id, fulfillmentStatus) {
  const order = getOrder(id);
  if (!order) return null;
  order.fulfillmentStatus = fulfillmentStatus;
  saveOrder(order);
  return order;
}

export function generatePdvOrderId() {
  return `PDV${Date.now().toString().slice(-8)}`;
}

export function computeStats(orders) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const paidOrders = orders.filter((o) => o.payment?.status === 'pago');
  const todayOrders = orders.filter((o) => new Date(o.date) >= today);
  const revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const onlineCount = orders.filter((o) => o.channel === 'online').length;
  const pdvCount = orders.filter((o) => o.channel === 'pdv').length;

  return {
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    pendingOrders: orders.length - paidOrders.length,
    todayOrders: todayOrders.length,
    revenue,
    avgTicket: paidOrders.length ? revenue / paidOrders.length : 0,
    onlineCount,
    pdvCount,
  };
}
