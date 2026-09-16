// "Clientes" continua sendo calculado agregando os pedidos por e-mail +
// contatos cadastrados manualmente - só que agora os dois vêm do banco
// compartilhado (via /api/orders e /api/customers) em vez de localStorage.
import { getAllOrders } from './orderStore.js';
import { apiGet, apiPost, apiDelete } from './apiClient.js';

let _cache = null;
let _promise = null;

async function loadManual() {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = apiGet('/customers')
      .then((data) => { _cache = data.customers; return _cache; })
      .catch((err) => { _promise = null; throw err; });
  }
  return _promise;
}

function invalidateManualCache() {
  _cache = null;
  _promise = null;
}

export async function getManualCustomers() {
  return loadManual();
}

export async function addManualCustomer(data) {
  const { customer } = await apiPost('/customers', data);
  invalidateManualCache();
  return customer;
}

export async function removeManualCustomer(id) {
  await apiDelete(`/customers/${id}`);
  invalidateManualCache();
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Junta pedidos (agrupados por e-mail) + contatos manuais em uma única
// lista de clientes, com pedidos, LTV (total gasto) e data de cadastro
// (primeira compra, ou data de criação para contatos manuais).
export async function getAllCustomers() {
  const [orders, manual] = await Promise.all([getAllOrders(), getManualCustomers()]);
  const byEmail = new Map();

  orders.forEach((order) => {
    const email = (order.customer?.email || '').toLowerCase().trim();
    const key = email || `sem-email-${order.customer?.firstName || 'cliente'}-${order.id}`;
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        id: key,
        firstName: order.customer?.firstName || 'Cliente',
        lastName: order.customer?.lastName || '',
        email: order.customer?.email || '',
        phone: order.customer?.phone || '',
        city: order.address?.city || (order.channel === 'pdv' ? 'Loja física' : ''),
        state: order.address?.state || '',
        orders: [],
        manual: false,
      });
    }
    byEmail.get(key).orders.push(order);
  });

  const fromOrders = Array.from(byEmail.values()).map((c) => finalizeCustomer(c));

  const manualFinalized = manual.map((c) => finalizeCustomer({ ...c, orders: [] }));

  // Evita duplicar um contato manual que já virou cliente de verdade (mesmo e-mail).
  const orderEmails = new Set(fromOrders.map((c) => c.email.toLowerCase()).filter(Boolean));
  const manualUnique = manualFinalized.filter((c) => !c.email || !orderEmails.has(c.email.toLowerCase()));

  return [...fromOrders, ...manualUnique].sort((a, b) => b.totalSpent - a.totalSpent);
}

function finalizeCustomer(c) {
  const paidOrders = c.orders.filter((o) => o.payment?.status === 'pago');
  const totalSpent = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const sortedOrders = [...c.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
  const firstOrderDate = c.orders.length ? c.orders.reduce((min, o) => (new Date(o.date) < new Date(min) ? o.date : min), c.orders[0].date) : c.createdAt;

  return {
    ...c,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    initials: initials(`${c.firstName} ${c.lastName}`),
    ordersCount: c.orders.length,
    totalSpent,
    createdAt: firstOrderDate || c.createdAt || new Date().toISOString(),
    orders: sortedOrders,
  };
}

export function exportCustomersCsv(customers) {
  const header = ['Nome', 'E-mail', 'Telefone', 'Cidade', 'Estado', 'Pedidos', 'Total gasto (R$)', 'Cliente desde'];
  const rows = customers.map((c) => [
    c.fullName, c.email, c.phone, c.city, c.state, c.ordersCount,
    c.totalSpent.toFixed(2).replace('.', ','),
    new Date(c.createdAt).toLocaleDateString('pt-BR'),
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  return '﻿' + csv; // BOM para acentuação correta ao abrir no Excel
}
