// Validação real de CPF/CNPJ (dígito verificador padrão, sem serviço
// externo) e formato de e-mail. Usado no cadastro de atacadista - nunca
// confiamos só na validação já feita no navegador (src/utils/validators.js
// tem a MESMA lógica, duplicada de propósito: importar de src/ dentro de
// /api quebra o build nesta plataforma, ver api/_catalogMeta.js).

export function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  const calcDigit = (base) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += digits[i] * (base + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calcDigit(9) === digits[9] && calcDigit(10) === digits[10];
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split('').map(Number);
  const calcDigit = (base) => {
    const weights = base === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base; i++) sum += digits[i] * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calcDigit(12) === digits[12] && calcDigit(13) === digits[13];
}

export function isValidDoc(docType, value) {
  return docType === 'cpf' ? isValidCpf(value) : docType === 'cnpj' ? isValidCnpj(value) : false;
}
