export function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function calcDiscountPercent(price, oldPrice) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function installmentText(price, max = 3) {
  const value = price / max;
  return `em até ${max}x de ${formatBRL(value)} sem juros`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g');

export function normalizeText(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .trim();
}

export function slugify(str = '') {
  return normalizeText(str).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
