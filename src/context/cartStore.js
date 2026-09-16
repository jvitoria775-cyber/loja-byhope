import { getItem, setItem } from '../utils/storage.js';
import { validateCoupon } from '../services/couponService.js';

const KEY = 'cart';
const COUPON_KEY = 'coupon';

let items = getItem(KEY, []);
let coupon = getItem(COUPON_KEY, null);

function emit() {
  window.dispatchEvent(new CustomEvent('cart:change', { detail: { items, coupon } }));
}

export function getItems() {
  return items;
}

function findIndex(id, size, color) {
  return items.findIndex((i) => i.id === id && i.size === size && i.color === color);
}

export function addItem(product, size, color, qty = 1) {
  const stock = product.stockBySize?.[size] ?? 99;
  const idx = findIndex(product.id, size, color);
  if (idx >= 0) {
    items[idx].qty = Math.min(items[idx].qty + qty, stock);
  } else {
    items.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images[0]?.src,
      size,
      color,
      qty: Math.min(qty, stock),
      stock,
    });
  }
  persist();
}

export function updateQty(id, size, color, qty) {
  const idx = findIndex(id, size, color);
  if (idx < 0) return;
  if (qty <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].qty = Math.min(qty, items[idx].stock ?? 99);
  }
  persist();
}

export function removeItem(id, size, color) {
  const idx = findIndex(id, size, color);
  if (idx >= 0) {
    items.splice(idx, 1);
    persist();
  }
}

export function clearCart() {
  items = [];
  coupon = null;
  setItem(COUPON_KEY, null);
  persist();
}

export function getCount() {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function getSubtotal() {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function applyCoupon(code) {
  const result = validateCoupon(code);
  if (!result) return { ok: false, message: 'Cupom inválido. Verifique o código digitado.' };
  coupon = result;
  setItem(COUPON_KEY, coupon);
  emit();
  return { ok: true, coupon: result };
}

export function removeCoupon() {
  coupon = null;
  setItem(COUPON_KEY, null);
  emit();
}

export function getCoupon() {
  return coupon;
}

function persist() {
  setItem(KEY, items);
  emit();
}
