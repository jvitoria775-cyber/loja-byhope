// Preenchimento automático de endereço a partir do CEP, via ViaCEP
// (serviço público brasileiro, gratuito, sem necessidade de chave).
// Usado no cadastro e no checkout pra evitar que o cliente digite rua,
// bairro, cidade e estado na mão - só número e complemento continuam
// manuais. Falha em silêncio (CEP não encontrado, ViaCEP fora do ar
// etc.) - o cliente sempre pode preencher os campos na mão se isso
// acontecer.
export async function lookupCep(cep) {
  const digits = String(cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.erro) return null;
    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}
