import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import { createPixOrder, createCardOrder, getOrder, verifyWebhookSignature } from './_mercadoPago.js';
import { maybeAutoPurchaseLabel } from './_melhorEnvio.js';

// Substitui a integração com a Pagar.me (autenticação nunca resolvida
// pelo suporte deles) - mesma vaga no orçamento de funções serverless do
// plano gratuito da Vercel.
//
// POST { action: 'create-order', orderId, selectedPaymentMethod, formData }
// - público, venda de varejo: recebe o resultado do Payment Brick
// (cartão OU Pix, o cliente escolhe dentro do próprio widget embutido no
// checkout, sem redirecionamento nenhum) e processa pro pedido já salvo
// em /api/orders.
// POST { action: 'create-pix-charge', orderId } - público, cliente
// atacadista: cria uma cobrança Pix direta (sem Brick, sem token) pro
// pedido já salvo, devolve QR code + copia-e-cola.
// POST { type: 'order', data: { id }, ... } - webhook do Mercado Pago:
// confirma o pagamento (sempre re-consultando a API deles, nunca
// confiando só no corpo da notificação) e dispara a geração automática
// da etiqueta.
//
// Em todos os casos de criação de cobrança, o valor/itens/cliente vêm do
// PEDIDO JÁ SALVO no banco (buscado por orderId), nunca de dados soltos
// que o navegador mandasse na hora - assim ninguém consegue manipular o
// valor cobrado alterando a requisição.
//
// IMPORTANTE: o payload real do webhook do Mercado Pago também tem um
// campo "action" (ex: "order.processed") - por isso a rota do webhook
// não pode ser "quando não vier action nenhum" (bug real, encontrado
// testando com um pedido de verdade: a notificação real caía direto no
// "Ação inválida" antes de sequer checar a assinatura). A distinção
// certa é o campo "type" - só a Mercado Pago manda "type: order".
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const body = readJsonBody(req);

  if (body.action === 'create-order') return handleCreateOrder(res, body);
  if (body.action === 'create-pix-charge') return handleCreatePixCharge(res, body);
  if (body.type === 'order') return handleWebhook(req, res, body);

  return sendJson(res, 400, { error: 'Ação inválida.' });
}

async function loadOrder(id) {
  const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
  return rows.length ? rows[0].data : null;
}

async function saveOrder(order) {
  await sql`
    UPDATE orders SET
      data = ${JSON.stringify(order)}::jsonb,
      status = ${order.payment?.status || 'pendente'},
      fulfillment_status = ${order.fulfillmentStatus || 'pendente'},
      updated_at = now()
    WHERE id = ${order.id}
  `;
}

function markPaid(order) {
  order.payment = order.payment || {};
  order.payment.status = 'pago';
  if (order.fulfillmentStatus !== 'enviado' && order.fulfillmentStatus !== 'cancelado') {
    order.fulfillmentStatus = 'pago';
  }
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'pago', date: new Date().toISOString() });
}

// Traduz os codigos de recusa mais comuns do cartao (documentados pelo
// Mercado Pago) pra uma mensagem que o cliente entenda - o status_detail
// cru (ex: "cc_rejected_insufficient_amount") não significa nada pra quem
// está comprando.
const CARD_REJECTION_MESSAGES = {
  cc_rejected_bad_filled_card_number: 'Revise o número do cartão.',
  cc_rejected_bad_filled_date: 'Revise a data de validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Revise o código de segurança (CVV).',
  cc_rejected_bad_filled_other: 'Revise os dados do cartão.',
  cc_rejected_call_for_authorize: 'Seu banco não autorizou esse valor. Ligue para o seu banco ou tente outro cartão.',
  cc_rejected_card_disabled: 'Cartão desativado. Ligue para o seu banco para ativá-lo ou use outro cartão.',
  cc_rejected_duplicated_payment: 'Já existe um pagamento com esses mesmos dados. Se precisar, tente novamente em alguns minutos.',
  cc_rejected_high_risk: 'Seu pagamento não foi aprovado. Tente outro cartão ou o Pix.',
  cc_rejected_insufficient_amount: 'Cartão sem limite suficiente para esse valor.',
  cc_rejected_invalid_installments: 'O cartão não aceita esse número de parcelas. Tente com menos parcelas.',
  cc_rejected_max_attempts: 'Número de tentativas excedido. Tente outro cartão ou o Pix.',
};

function cardRejectionMessage(statusDetail) {
  return CARD_REJECTION_MESSAGES[statusDetail] || 'O pagamento não foi aprovado pelo seu banco. Tente outro cartão ou o Pix.';
}

// Ponto de entrada do Payment Brick (varejo): o cliente escolhe cartão ou
// Pix dentro do próprio widget embutido no checkout, e o Brick devolve
// aqui o resultado (token do cartão já tokenizado, ou o método "pix").
async function handleCreateOrder(res, body) {
  const { orderId, selectedPaymentMethod, formData } = body;
  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  try {
    if (selectedPaymentMethod === 'bank_transfer') {
      const { mpOrderId, qrCode, qrCodeBase64, ticketUrl } = await createPixOrder({ order });
      order.payment = order.payment || {};
      order.payment.mpOrderId = mpOrderId;
      order.payment.pixQrCode = qrCode;
      order.payment.pixQrCodeBase64 = qrCodeBase64;
      order.payment.pixTicketUrl = ticketUrl;
      await saveOrder(order);
      return sendJson(res, 200, { paid: false, qrCode, qrCodeBase64, ticketUrl });
    }

    const { mpOrderId, paymentStatus, statusDetail } = await createCardOrder({ order, formData });
    order.payment = order.payment || {};
    order.payment.mpOrderId = mpOrderId;
    order.payment.statusDetail = statusDetail;

    if (paymentStatus === 'processed') {
      markPaid(order);
      await maybeAutoPurchaseLabel(order);
      await saveOrder(order);
      return sendJson(res, 200, { paid: true });
    }

    await saveOrder(order);
    if (paymentStatus === 'failed') {
      return sendJson(res, 402, { error: cardRejectionMessage(statusDetail) });
    }
    // created/processing/in_process/action_required etc. (raro em
    // cartão, mas possível em alguns emissores - ex.: 3DS)
    return sendJson(res, 200, { paid: false, pending: true });
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Não foi possível processar o pagamento.' });
  }
}

// Cliente atacadista: sem Brick, sem token - é direto o servidor pedindo
// a cobrança Pix pro Mercado Pago.
async function handleCreatePixCharge(res, body) {
  const { orderId } = body;
  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  try {
    const { mpOrderId, qrCode, qrCodeBase64, ticketUrl } = await createPixOrder({ order });
    order.payment = order.payment || {};
    order.payment.mpOrderId = mpOrderId;
    order.payment.pixQrCode = qrCode;
    order.payment.pixQrCodeBase64 = qrCodeBase64;
    order.payment.pixTicketUrl = ticketUrl;
    await saveOrder(order);
    return sendJson(res, 200, { qrCode, qrCodeBase64, ticketUrl });
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Não foi possível gerar a cobrança Pix.' });
  }
}

// Webhook: nunca confia nos dados que vêm dentro do corpo da notificação
// (podem estar incompletos ou desatualizados) - sempre confirma
// re-consultando a API do Mercado Pago com o id recebido, depois de
// validar a assinatura HMAC do cabeçalho x-signature.
async function handleWebhook(req, res, body) {
  const dataId = body?.data?.id;
  if (body?.type !== 'order' || !dataId) {
    return sendJson(res, 200, { ok: true, ignored: body?.type || 'sem tipo' });
  }

  if (!verifyWebhookSignature(req, dataId)) {
    return sendJson(res, 401, { error: 'Assinatura inválida.' });
  }

  let mpOrder;
  try {
    mpOrder = await getOrder(dataId);
  } catch (err) {
    // Devolve 200 mesmo assim - um 4xx/5xx faria o Mercado Pago reenviar a
    // notificação em loop, e uma falha temporária na consulta não deve
    // travar a fila de notificações deles.
    return sendJson(res, 200, { ok: true, warning: `Não foi possível confirmar o pedido: ${err.message}` });
  }

  const orderId = mpOrder.external_reference;
  if (!orderId) return sendJson(res, 200, { ok: true, warning: 'Notificação sem external_reference.' });

  const order = await loadOrder(orderId);
  if (!order) return sendJson(res, 200, { ok: true, warning: 'Pedido não encontrado para esta notificação.' });

  const paymentStatus = mpOrder.transactions?.payments?.[0]?.status;
  order.payment = order.payment || {};

  if (paymentStatus === 'processed' && order.payment.status !== 'pago') {
    markPaid(order);
    await maybeAutoPurchaseLabel(order);
  } else if (
    (paymentStatus === 'failed' || paymentStatus === 'canceled' || paymentStatus === 'expired')
    && order.payment.status !== 'pago'
  ) {
    order.payment.status = 'cancelado';
  }

  await saveOrder(order);
  return sendJson(res, 200, { ok: true });
}
