import { slugify } from '../utils/format.js';

// Todas as imagens abaixo são fotos reais dos produtos, fornecidas pela
// GRATITUDE TÊXTIL (pasta oficial do Google Drive) e hospedadas localmente
// em /public/products/<categoria>/<cor>-<n>.<ext>.
// Todas as fotos foram otimizadas para .jpg (ver public/products/<categoria>/<cor>-N.jpg)
function pi(category, colorSlug, count = 3) {
  return Array.from({ length: count }, (_, i) => `/public/products/${category}/${colorSlug}-${i + 1}.jpg`);
}

const SIZES_DEFAULT = ['P', 'M', 'G', 'GG'];
const SIZES_REGATA = ['PP', 'P', 'M', 'G', 'GG'];

function stockAll(sizes, qty = 999) {
  const out = {};
  sizes.forEach((s) => { out[s] = qty; });
  return out;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------
// Preço de venda = (custo do produto + custo fixo de envio/embalagem) / 0,70
// (30% de margem líquida sobre o preço final), arredondado comercialmente
// para a casa ",90" imediatamente acima do valor calculado — nunca abaixo,
// para nunca reduzir a margem de 30% combinada. Custos reais fornecidos
// pela empresa (arquivo CUSTO.txt):
//   Custo do produto: Baby Look R$8,60 / Cropped R$9,50 / Regata R$9,50 /
//     Short Tectel R$10,20 / Moletom R$30,00 / Camiseta R$10,00
//   Custo fixo de envio por peça: saquinho (R$0,50) + etiqueta (R$0,10) +
//     fita (R$0,10) + etiquetas (R$0,50) + mão de obra (R$1,90) = R$3,10
// ---------------------------------------------------------------------

export const products = [
  {
    id: 'gt-001',
    name: 'Camiseta Básica Unissex',
    category: 'camiseta',
    categoryLabel: 'Camisetas',
    price: 18.90,
    description: 'Camiseta básica unissex confeccionada em meia malha 100% algodão, com gramatura de 160 a 180 g/m² para garantir maciez e durabilidade lavagem após lavagem. Gola redonda em ribana 1x1 e mangas curtas — a peça coringa do guarda-roupa, para ele e para ela.',
    composition: ['Composição: 100% Algodão', 'Tecido: Meia Malha', 'Gramatura: 160–180 g/m²', 'Gola: Redonda em ribana 1x1', 'Mangas: Curtas'],
    sizes: SIZES_DEFAULT,
    stockBySize: stockAll(SIZES_DEFAULT),
    sizeChartImage: '/public/sizeguides/camiseta.png',
    colors: [
      { name: 'Azul Royal', slug: 'azulroyal', hex: '#1F4FC4' },
      { name: 'Bege', slug: 'bege', hex: '#D8C3A0' },
      { name: 'Bordô', slug: 'bordo', hex: '#6B1F2A' },
      { name: 'Branca', slug: 'branca', hex: '#FBFBF9' },
      { name: 'Cinza Mescla', slug: 'cinzamescla', hex: '#9C9C9C' },
      { name: 'Marinho', slug: 'marinho', hex: '#1B2A4A' },
      { name: 'Marrom', slug: 'marrom', hex: '#5C4030' },
      { name: 'Preta', slug: 'preta', hex: '#1A1A1A' },
      { name: 'Rosa', slug: 'rosa', hex: '#E8A3BC' },
      { name: 'Verde Escuro', slug: 'verdeescuro', hex: '#1F4B34' },
      { name: 'Vermelho', slug: 'vermelho', hex: '#C0272D' },
    ],
    colorImages: {
      azulroyal: pi('camiseta', 'azulroyal'),
      bege: pi('camiseta', 'bege'),
      bordo: pi('camiseta', 'bordo'),
      branca: pi('camiseta', 'branca'),
      cinzamescla: pi('camiseta', 'cinzamescla'),
      marinho: pi('camiseta', 'marinho'),
      marrom: pi('camiseta', 'marrom'),
      preta: pi('camiseta', 'preta'),
      rosa: pi('camiseta', 'rosa'),
      verdeescuro: pi('camiseta', 'verdeescuro'),
      vermelho: pi('camiseta', 'vermelho'),
    },
    createdAt: daysAgo(5),
  },
  {
    id: 'gt-002',
    name: 'Baby Look Feminina',
    category: 'babylook',
    categoryLabel: 'Baby Look',
    price: 16.90,
    description: 'Baby look feminina em meia malha 100% algodão, com gramatura de 160 a 180 g/m². Modelagem justa ao corpo, gola redonda em ribana 1x1 e mangas curtas — a peça essencial para compor looks casuais do dia a dia.',
    composition: ['Composição: 100% Algodão', 'Tecido: Meia Malha', 'Gramatura: 160–180 g/m²', 'Gola: Redonda em ribana 1x1', 'Mangas: Curtas'],
    sizes: SIZES_DEFAULT,
    stockBySize: stockAll(SIZES_DEFAULT),
    sizeChartImage: '/public/sizeguides/babylook.png',
    colors: [
      { name: 'Preto', slug: 'preto', hex: '#1A1A1A' },
      { name: 'Branco', slug: 'branco', hex: '#FBFBF9' },
      { name: 'Cinza', slug: 'cinza', hex: '#9C9C9C' },
      { name: 'Lilás', slug: 'lilas', hex: '#C9B8E8' },
      { name: 'Rosa', slug: 'rosa', hex: '#E8A3BC' },
    ],
    colorImages: {
      preto: pi('babylook', 'preto'),
      branco: pi('babylook', 'branco'),
      cinza: pi('babylook', 'cinza'),
      lilas: pi('babylook', 'lilas'),
      rosa: pi('babylook', 'rosa'),
    },
    createdAt: daysAgo(3),
  },
  {
    id: 'gt-003',
    name: 'Cropped Feminino',
    category: 'cropped',
    categoryLabel: 'Cropped',
    price: 18.90,
    description: 'Cropped feminino básico em meia malha 100% algodão, com gramatura de 160 a 180 g/m². Corte cropped, gola redonda em ribana 1x1 e mangas curtas — perfeito para compor com calças e saias de cintura alta.',
    composition: ['Composição: 100% Algodão', 'Tecido: Meia Malha', 'Gramatura: 160–180 g/m²', 'Gola: Redonda em ribana 1x1', 'Mangas: Curtas'],
    sizes: SIZES_DEFAULT,
    stockBySize: stockAll(SIZES_DEFAULT),
    sizeChartImage: '/public/sizeguides/cropped.png',
    colors: [
      { name: 'Branca', slug: 'branca', hex: '#FBFBF9' },
      { name: 'Preta', slug: 'preta', hex: '#1A1A1A' },
    ],
    colorImages: {
      branca: pi('cropped', 'branca'),
      preta: pi('cropped', 'preta'),
    },
    createdAt: daysAgo(8),
  },
  {
    id: 'gt-004',
    name: 'Regata Tradicional Feminina',
    category: 'regata',
    categoryLabel: 'Regata',
    price: 18.90,
    description: 'Regata tradicional feminina, cavada e sem mangas, em meia malha 100% algodão. Modelagem básica e confortável, ideal para o dia a dia ou para compor looks em camadas.',
    composition: ['Composição: 100% Algodão', 'Tecido: Meia Malha', 'Modelagem: Cavada, sem mangas', 'Observação: nas laterais há uma perda de 0,5 cm de costura e, na barra, 1 cm'],
    sizes: SIZES_REGATA,
    stockBySize: stockAll(SIZES_REGATA),
    sizeChartImage: '/public/sizeguides/regata.png',
    colors: [
      { name: 'Branca', slug: 'branca', hex: '#FBFBF9' },
      { name: 'Preta', slug: 'preta', hex: '#1A1A1A' },
      { name: 'Rosa', slug: 'rosa', hex: '#E8A3BC' },
    ],
    colorImages: {
      branca: pi('regata', 'branca'),
      preta: pi('regata', 'preta'),
      rosa: pi('regata', 'rosa'),
    },
    createdAt: daysAgo(12),
  },
  {
    id: 'gt-005',
    name: 'Moletom Canguru',
    category: 'moletom',
    categoryLabel: 'Moletom',
    price: 47.90,
    description: 'Moletom canguru unissex, peluciado, em composição de aproximadamente 80% algodão e 20% poliéster, com gramatura de 280 g/m². Capuz duplo com cordão ajustável, bolso canguru frontal e acabamento em ribana nos punhos e na barra, com costuras reforçadas.',
    composition: ['Composição: ~80% Algodão / 20% Poliéster (peluciado)', 'Gramatura: 280 g/m²', 'Modelagem: Tradicional / Confortável', 'Capuz: Duplo com cordão ajustável', 'Bolso: Canguru frontal', 'Acabamento: Punhos e barra em ribana, costuras reforçadas'],
    sizes: SIZES_DEFAULT,
    stockBySize: stockAll(SIZES_DEFAULT),
    sizeChartImage: '/public/sizeguides/moletom.png',
    colors: [
      { name: 'Bege', slug: 'bege', hex: '#D8C3A0' },
      { name: 'Bordô', slug: 'bordo', hex: '#6B1F2A' },
      { name: 'Branco', slug: 'branco', hex: '#FBFBF9' },
      { name: 'Cinza Mescla', slug: 'cinzamescla', hex: '#9C9C9C' },
      { name: 'Marinho', slug: 'marinho', hex: '#1B2A4A' },
      { name: 'Preto', slug: 'preto', hex: '#1A1A1A' },
      { name: 'Rosa', slug: 'rosa', hex: '#E8A3BC' },
    ],
    colorImages: {
      bege: pi('moletom', 'bege'),
      bordo: pi('moletom', 'bordo'),
      branco: pi('moletom', 'branco'),
      cinzamescla: pi('moletom', 'cinzamescla'),
      marinho: pi('moletom', 'marinho'),
      preto: pi('moletom', 'preto'),
      rosa: pi('moletom', 'rosa'),
    },
    createdAt: daysAgo(1),
  },
  {
    id: 'gt-006',
    name: 'Short Tectel Masculino',
    category: 'short',
    categoryLabel: 'Shorts',
    price: 19.90,
    description: 'Short masculino em tecido Tectel 100% poliéster, leve e respirável — ideal para o dia a dia ou para a prática esportiva. Cós com elástico total e cordão ajustável, bolsos laterais, barra reta e costuras reforçadas.',
    composition: ['Composição: 100% Poliéster (Tectel)', 'Tecido: Tectel / Tecido Plano', 'Cós: Elástico total + cordão ajustável', 'Bolsos: Laterais', 'Acabamento: Costuras reforçadas, barra reta'],
    sizes: SIZES_DEFAULT,
    stockBySize: stockAll(SIZES_DEFAULT),
    sizeChartImage: '/public/sizeguides/short.png',
    colors: [
      { name: 'Marinho', slug: 'marinho', hex: '#1B2A4A' },
      { name: 'Preto', slug: 'preto', hex: '#1A1A1A' },
    ],
    colorImages: {
      marinho: pi('short', 'marinho'),
      preto: pi('short', 'preto'),
    },
    createdAt: daysAgo(15),
  },
].map((p) => {
  const slug = `${slugify(p.name)}-${p.id}`;
  const firstColor = p.colors[0].slug;
  const images = p.colorImages[firstColor].map((src, i) => ({ src, alt: `${p.name} - ${p.colors[0].name}${i > 0 ? ' - vista ' + (i + 1) : ''}` }));
  const totalStock = Object.values(p.stockBySize).reduce((a, b) => a + b, 0);
  return { ...p, slug, images, totalStock };
});

export function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug || p.id === slug);
}

export function getRelated(product, limit = 4) {
  return products.filter((p) => p.id !== product.id).slice(0, limit);
}

export function getImagesForColor(product, colorSlug) {
  const list = product.colorImages[colorSlug] || product.images.map((i) => i.src);
  return list.map((src, i) => ({ src, alt: `${product.name}${i > 0 ? ' - vista ' + (i + 1) : ''}` }));
}
