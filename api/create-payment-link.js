import { handlePreflight, readJsonBody, sendJson } from './_db.js';

// Ponte segura para a API oficial de Checkout Integrado da InfinitePay
// (https://www.infinitepay.io/checkout-documentacao). O handle (InfiniteTag)
// fica só aqui no servidor via variável de ambiente - nunca é exposto no
// código do navegador. Porta fiel de Handle-CreatePaymentLink em
// server.ps1 (mesmo contrato de entrada/saída), então src/services/
// paymentService.js não precisa mudar nada.
const INFINITEPAY_LINKS_URL = 'https://api.checkout.infinitepay.io/links';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const payload = readJsonBody(req);
  if (!payload.items || !payload.items.length) {
    return sendJson(res, 400, { error: 'Nenhum item informado para o pagamento.' });
  }

  const handle = process.env.INFINITEPAY_HANDLE || 'alivio';
  const body = {
    handle,
    order_nsu: String(payload.order_nsu || ''),
    redirect_url: payload.redirect_url,
    items: payload.items,
  };
  if (payload.customer) body.customer = payload.customer;

  try {
    const apiRes = await fetch(INFINITEPAY_LINKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const data = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok) {
      return sendJson(res, 502, { error: 'Não foi possível gerar o link de pagamento na InfinitePay.', detail: data });
    }

    const checkoutUrl = data.url || data.payment_url || data.checkout_url || data.link;
    if (!checkoutUrl) {
      return sendJson(res, 502, { error: 'A InfinitePay respondeu, mas não foi possível identificar o link de pagamento.', raw: data });
    }
    return sendJson(res, 200, { url: checkoutUrl });
  } catch (err) {
    return sendJson(res, 502, { error: 'Não foi possível gerar o link de pagamento na InfinitePay.', detail: err.message });
  }
}
