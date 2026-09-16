// Camada de pedidos do painel/PDV. Antes vivia inteiramente em
// localStorage (visível só no navegador que criou o pedido); agora lê e
// grava no banco compartilhado via /api/orders, então qualquer pedido
// feito pela loja ou pelo PDV, em qualquer aparelho, aparece aqui.
import { apiGet, apiPost, apiPatch } from './apiClient.js';

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

let _cache = null;
let _promise = null;

async function loadOrders() {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = apiGet('/orders')
      .then((data) => { _cache = data.orders; return _cache; })
      .catch((err) => { _promise = null; throw err; });
  }
  return _promise;
}

export function invalidateOrdersCache() {
  _cache = null;
  _promise = null;
}

export async function getAllOrders() {
  const orders = await loadOrders();
  return [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Usado pelo PDV para registrar uma venda de balcão. O endpoint aceita a
// criação sem exigir o token do painel (o checkout da loja também usa a
// mesma rota, sem estar autenticado como admin), mas o apiClient sempre
// envia o token quando ele existir - o que é o caso aqui, já que o PDV só
// é alcançado depois da tela de PIN.
export async function saveOrder(order) {
  const { order: saved } = await apiPost('/orders', order);
  invalidateOrdersCache();
  return saved;
}

export async function updateFulfillmentStatus(id, status) {
  const { order } = await apiPatch(`/orders/${id}`, { fulfillmentStatus: status });
  invalidateOrdersCache();
  return order;
}

export async function updateTrackingCode(id, trackingCode) {
  const { order } = await apiPatch(`/orders/${id}`, { trackingCode });
  invalidateOrdersCache();
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
