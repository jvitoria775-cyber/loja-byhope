// Cotação real de frete via Melhor Envio (Correios PAC/SEDEX + JeT
// Standard, a pedido da loja). O peso de cada item vem da categoria do
// produto (a própria API resolve o peso/caixa padrão configurados em
// Configurações > Frete) - o navegador só manda categoria + quantidade,
// nunca peso, pra não depender de nenhum dado sensível a manipulação
// ficar só no cliente.
export function isValidCep(cep) {
  return /^\d{5}-?\d{3}$/.test((cep || '').trim());
}

export async function calculateShipping(cep, items) {
  const payload = {
    action: 'calculate',
    toCep: cep,
    items: items.map((i) => ({ category: i.category, qty: i.qty })),
  };
  const res = await fetch('/api/shipping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível calcular o frete. Tente novamente.');
  return { options: data.options || [], error: data.error };
}
