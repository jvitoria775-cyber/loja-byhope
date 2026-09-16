// "Clientes" não é uma entidade própria hoje (não há backend/banco) - por
// isso construímos a lista agregando os dados de cliente presentes em cada
// pedido (agrupando por e-mail) e somando com contatos cadastrados
// manualmente pela equipe (guardados em amara:customers_manual).
import { getAllOrders } from './orderStore.js';
import { getItem, setItem } from '../utils/storage.js';

const MANUAL_KEY = 'customers_manual';

export function getManualCustomers() {
  return getItem(MANUAL_KEY, []);
}

export function addManualCustomer(data) {
  const list = getManualCustomers();
  const customer = {
    id: `manual-${Date.now()}`,
    firstName: data.firstName,
    lastName: data.lastName || '',
    email: data.email,
    phone: data.phone || '',
    city: data.city || '',
    state: data.state || '',
    createdAt: new Date().toISOString(),
    manual: true,
  };
  list.push(customer);
  setItem(MANUAL_KEY, list);
  return customer;
}

export function removeManualCustomer(id) {
  const list = getManualCustomers().filter((c) => c.id !== id);
  setItem(MANUAL_KEY, list);
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Junta pedidos (agrupados por e-mail) + contatos manuais em uma única
// lista de clientes, com pedidos, LTV (total gasto) e data de cadastro
// (primeira compra, ou data de criação para contatos manuais).
export function getAllCustomers() {
  const orders = getAllOrders();
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

  const manual = getManualCustomers().map((c) => finalizeCustomer({ ...c, orders: [] }));

  // Evita duplicar um contato manual que já virou cliente de verdade (mesmo e-mail).
  const orderEmails = new Set(fromOrders.map((c) => c.email.toLowerCase()).filter(Boolean));
  const manualUnique = manual.filter((c) => !c.email || !orderEmails.has(c.email.toLowerCase()));

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
