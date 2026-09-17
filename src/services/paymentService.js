// Ponte para a API da Pagar.me (Stone). A chamada real (com a chave
// secreta) acontece só no servidor (api/payment.js) - o navegador nunca
// vê a credencial.
export async function createCheckoutLink({ orderId, redirectUrl }) {
  const res = await fetch('/api/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create-checkout-link', orderId, redirectUrl }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia/inválida */ }

  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
  }
  return data.url;
}

// Cobrança Pix direta (cliente atacadista) - sem redirecionamento, devolve
// o QR code e o código copia-e-cola pra mostrar na própria página do
// pedido.
export async function createPixCharge({ orderId }) {
  const res = await fetch('/api/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create-pix-charge', orderId }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia/inválida */ }

  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível gerar a cobrança Pix.');
  }
  return data;
}
