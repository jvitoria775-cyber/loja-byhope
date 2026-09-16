// Ponte para a API oficial de Checkout Integrado da InfinitePay.
// A chamada real para a InfinitePay acontece no servidor local (server.ps1)
// - o handle (InfiniteTag) nunca fica exposto no código do navegador.
export async function createInfinitePayLink({ items, orderNsu, redirectUrl, customer }) {
  const res = await fetch('/api/create-payment-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, order_nsu: orderNsu, redirect_url: redirectUrl, customer }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia/inválida */ }

  if (!res.ok || !data.url) {
    const message = data.error || 'Não foi possível iniciar o pagamento com a InfinitePay.';
    throw new Error(message);
  }
  return data.url;
}
