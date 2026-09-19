// Ponte para a API do Mercado Pago. A chamada real (com o access token)
// acontece só no servidor (api/payment.js) - o navegador nunca vê essa
// credencial. A Public Key é diferente: não é segredo, é feita pra rodar
// no navegador (o SDK do Mercado Pago usa ela pra tokenizar o cartão).
let sdkPromise = null;

// Carrega o SDK JS do Mercado Pago uma única vez (mesmo se chamado de
// novo em navegações repetidas pro checkout) e devolve a instância já
// inicializada com a Public Key.
export async function loadMercadoPago() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const settingsRes = await fetch('/api/settings');
      const settings = await settingsRes.json().catch(() => ({}));
      const publicKey = settings.mercadoPago?.publicKey;
      if (!publicKey) throw new Error('Pagamento não configurado (Mercado Pago sem Public Key). Avise a loja.');

      if (!window.MercadoPago) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.mercadopago.com/js/v2';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago. Verifique sua conexão.'));
          document.head.appendChild(script);
        });
      }
      return new window.MercadoPago(publicKey, { locale: 'pt-BR' });
    })().catch((err) => { sdkPromise = null; throw err; });
  }
  return sdkPromise;
}

// Resultado do Payment Brick (varejo): o cliente escolheu cartão ou Pix
// dentro do próprio widget embutido no checkout - manda o que o Brick
// devolveu pro servidor processar.
export async function createOrder({ orderId, selectedPaymentMethod, formData }) {
  const res = await fetch('/api/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create-order', orderId, selectedPaymentMethod, formData }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia/inválida */ }

  if (!res.ok) throw new Error(data.error || 'Não foi possível processar o pagamento.');
  return data;
}

// Cobrança Pix direta (cliente atacadista) - sem Brick, sem token, devolve
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

  if (!res.ok) throw new Error(data.error || 'Não foi possível gerar a cobrança Pix.');
  return data;
}
