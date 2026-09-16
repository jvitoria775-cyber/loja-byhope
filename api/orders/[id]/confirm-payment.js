import { sql, handlePreflight, readJsonBody, sendJson } from '../../_db.js';

// PATCH: marca um pedido como pago com os dados que a InfinitePay devolve
// no redirecionamento pós-pagamento (capture_method, transaction_nsu,
// receipt_url). Público de propósito - é o próprio cliente confirmando o
// pagamento dele na página de sucesso, sem estar logado como admin. Por
// segurança, só mexe nos campos de pagamento - nunca em itens, endereço,
// valores ou status de separação/envio.
//
// Limitação conhecida (documentada): como a InfinitePay Checkout Integrado
// usado aqui não expõe um webhook assinado neste projeto, a confirmação
// depende dos parâmetros da URL de redirecionamento, e não de uma
// notificação servidor-a-servidor verificável. Para um negócio de maior
// volume, o ideal é migrar para confirmação via webhook assinado.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Método não permitido.' });

  const { id } = req.query;
  const { captureMethod, transactionNsu, receiptUrl } = readJsonBody(req);

  const { rows } = await sql`SELECT data FROM orders WHERE id = ${id}`;
  if (!rows.length) return sendJson(res, 404, { error: 'Pedido não encontrado.' });

  const order = rows[0].data;
  order.payment = order.payment || {};
  order.payment.status = 'pago';
  if (captureMethod) order.payment.method = captureMethod;
  if (transactionNsu) order.payment.transactionNsu = transactionNsu;
  if (receiptUrl) order.payment.receiptUrl = receiptUrl;
  if (order.fulfillmentStatus !== 'enviado' && order.fulfillmentStatus !== 'cancelado') {
    order.fulfillmentStatus = 'pago';
  }
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'pago', date: new Date().toISOString() });

  await sql`
    UPDATE orders SET
      data = ${JSON.stringify(order)}::jsonb,
      status = 'pago',
      fulfillment_status = ${order.fulfillmentStatus},
      updated_at = now()
    WHERE id = ${id}
  `;
  return sendJson(res, 200, { order });
}
