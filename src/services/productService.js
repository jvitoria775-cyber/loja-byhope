import { normalizeText } from '../utils/format.js';

export function filterAndSort(products, opts = {}) {
  const {
    query = '', category = '', tag = '', sizes = [], colors = [],
    priceMin = null, priceMax = null, sort = 'relevancia',
  } = opts;

  let list = [...products];

  if (category) list = list.filter((p) => p.category === category);

  if (tag === 'novidades') {
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  }

  if (query) {
    const q = normalizeText(query);
    const terms = q.split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const haystack = normalizeText(
        `${p.name} ${p.description} ${p.category} ${p.categoryLabel} ${p.colors.map((c) => c.name).join(' ')}`
      );
      return terms.every((t) => haystack.includes(t));
    });
  }

  if (sizes.length) list = list.filter((p) => sizes.some((s) => p.sizes.includes(s) && p.stockBySize[s] > 0));
  if (colors.length) list = list.filter((p) => colors.some((c) => p.colors.some((pc) => pc.name === c)));
  if (priceMin != null) list = list.filter((p) => p.price >= priceMin);
  if (priceMax != null) list = list.filter((p) => p.price <= priceMax);

  switch (sort) {
    case 'menor-preco': list.sort((a, b) => a.price - b.price); break;
    case 'maior-preco': list.sort((a, b) => b.price - a.price); break;
    case 'mais-recentes': list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    default: list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); break;
  }

  return list;
}

export function getAvailableColors(products) {
  const map = new Map();
  products.forEach((p) => p.colors.forEach((c) => map.set(c.name, c.hex)));
  return Array.from(map, ([name, hex]) => ({ name, hex }));
}
