function round2(n) {
  return Math.round(n * 100) / 100;
}

export function isValidCep(cep) {
  return /^\d{5}-?\d{3}$/.test((cep || '').trim());
}

const REGIONS = {
  0: 'São Paulo (Capital e região)', 1: 'São Paulo (Interior)', 2: 'Rio de Janeiro / Espírito Santo',
  3: 'Minas Gerais', 4: 'Bahia / Sergipe', 5: 'Pernambuco / Alagoas / Paraíba / RN',
  6: 'Ceará / Piauí / Maranhão / Norte', 7: 'Distrito Federal / Goiás / Centro-Oeste',
  8: 'Paraná / Santa Catarina', 9: 'Rio Grande do Sul',
};

export function simulateShipping(cep) {
  const clean = (cep || '').replace(/\D/g, '');
  if (clean.length !== 8) return null;

  const region = Number(clean[0]);
  const baseEco = 14.9 + region * 1.9;
  const baseExp = 27.9 + region * 2.6;
  const days = { eco: 5 + (region % 4), exp: 2 + (region % 2) };

  return {
    region: REGIONS[region] || 'Brasil',
    options: [
      { type: 'economico', label: 'Frete Econômico', price: round2(baseEco), days: days.eco },
      { type: 'expresso', label: 'Frete Expresso', price: round2(baseExp), days: days.exp },
    ],
  };
}
