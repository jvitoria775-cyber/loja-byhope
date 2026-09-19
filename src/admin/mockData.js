// Gerador de dados de demonstração para o painel administrativo.
// Continua usando os PRODUTOS REAIS do catálogo (data/products.js) para
// montar pedidos de teste realistas - mas agora, em vez de gravar direto
// no localStorage, envia o lote pronto para /api/demo, que grava no banco
// compartilhado (marcados com demo:true, para poder limpar só esses depois).
//
// Diferente da versão local: NÃO roda mais sozinho ao abrir o painel. Popular
// pedidos fictícios automaticamente deixa de fazer sentido quando o banco é
// compartilhado e pode conter pedidos reais de clientes - agora é sempre uma
// ação manual, pelo botão em Configurações.
import { products } from '../data/products.js';
import { apiPost, apiDelete } from './apiClient.js';

const FIRST_NAMES_F = ['Ana', 'Mariana', 'Camila', 'Fernanda', 'Juliana', 'Beatriz', 'Larissa', 'Patrícia', 'Gabriela', 'Rafaela', 'Carolina', 'Amanda', 'Bruna', 'Letícia', 'Vanessa'];
const FIRST_NAMES_M = ['Lucas', 'Pedro', 'Gustavo', 'Rafael', 'Thiago', 'Bruno', 'Felipe', 'Rodrigo', 'André', 'Diego', 'Marcelo', 'Eduardo', 'Vinícius', 'Gabriel', 'Leonardo'];
const LAST_NAMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Barbosa'];
const CITIES = [
  { city: 'São Paulo', state: 'SP' }, { city: 'Campinas', state: 'SP' }, { city: 'Rio de Janeiro', state: 'RJ' },
  { city: 'Belo Horizonte', state: 'MG' }, { city: 'Curitiba', state: 'PR' }, { city: 'Porto Alegre', state: 'RS' },
  { city: 'Salvador', state: 'BA' }, { city: 'Fortaleza', state: 'CE' }, { city: 'Brasília', state: 'DF' },
];
const STREETS = ['Rua das Flores', 'Av. Paulista', 'Rua Sete de Setembro', 'Rua XV de Novembro', 'Av. Brasil', 'Rua dos Andradas', 'Rua Barão do Rio Branco'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n, hour = randInt(9, 20)) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, randInt(0, 59), 0, 0);
  return d.toISOString();
}

function randomName() {
  const isF = Math.random() > 0.5;
  const first = pick(isF ? FIRST_NAMES_F : FIRST_NAMES_M);
  const last = pick(LAST_NAMES);
  return { firstName: first, lastName: last, email: `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@email.com' };
}

function randomItems() {
  const count = randInt(1, 3);
  const items = [];
  for (let i = 0; i < count; i++) {
    const product = pick(products);
    const color = pick(product.colors);
    const size = pick(product.sizes);
    const qty = randInt(1, 2);
    items.push({
      id: product.id, slug: product.slug, name: product.name, price: product.price,
      image: (product.colorImages[color.slug] || product.images.map((im) => im.src))[0],
      size, color: color.name, qty, stock: 40,
    });
  }
  return items;
}

function buildOrder(dayOffset, channel) {
  const items = randomItems();
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasDiscount = Math.random() < 0.2;
  const discount = hasDiscount ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const shippingPrice = channel === 'pdv' ? 0 : Math.round((14.9 + randInt(0, 15)) * 100) / 100;
  const total = Math.max(subtotal - discount + shippingPrice, 0);
  const { firstName, lastName, email } = randomName();
  const loc = pick(CITIES);

  const statusRoll = Math.random();
  let status = 'pago';
  if (statusRoll > 0.94) status = 'cancelado';
  else if (statusRoll > 0.84) status = 'aguardando confirmação';

  let fulfillment = 'pendente';
  if (status === 'pago') {
    const f = Math.random();
    fulfillment = f > 0.8 ? 'enviado' : f > 0.55 ? 'em separação' : 'pago';
  } else if (status === 'cancelado') {
    fulfillment = 'cancelado';
  }

  const date = daysAgo(dayOffset);
  const id = `${channel === 'pdv' ? 'PDV' : 'GT'}${Math.random().toString().slice(2, 10)}`;

  return {
    id,
    date,
    channel,
    items,
    customer: { firstName, lastName, email, phone: `(11) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}` },
    address: channel === 'pdv' ? null : {
      cep: `${randInt(10000, 99999)}-${randInt(100, 999)}`, street: pick(STREETS), number: String(randInt(10, 2000)),
      complement: '', neighborhood: 'Centro', city: loc.city, state: loc.state,
    },
    shipping: channel === 'pdv' ? { type: 'retirada', label: 'Venda no balcão', price: 0, days: 0 } : { type: 'economico', label: 'Frete Econômico', price: shippingPrice, days: randInt(3, 12) },
    payment: { method: channel === 'pdv' ? pick(['dinheiro', 'cartao', 'mercadopago']) : 'mercadopago', status },
    fulfillmentStatus: fulfillment,
    statusHistory: [{ status: fulfillment, date }],
    trackingCode: fulfillment === 'enviado' ? `BR${randInt(100000000, 999999999)}BR` : '',
    coupon: hasDiscount ? { code: 'MODA10', type: 'percent', value: 10, label: 'MODA10: 10% de desconto' } : null,
    subtotal, discount, shippingDiscount: 0, shippingPrice, total,
    demo: true,
  };
}

export function hasDemoOrders(orders) {
  return orders.some((o) => o.demo);
}

export async function seedDemoData(count = 46) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = randInt(0, 45);
    const channel = Math.random() < 0.68 ? 'online' : 'pdv';
    orders.push(buildOrder(dayOffset, channel));
  }
  await apiPost('/demo', { orders });
}

export async function clearDemoData() {
  await apiDelete('/demo');
}
