import { sql, handlePreflight, readJsonBody, sendJson } from './_db.js';
import {
  getOAuthAuthorizeUrl, exchangeCodeForTokens, getConnectionStatus,
  calculateShipping, computeTotalWeightKg, DEFAULT_PACKAGE_DIMS,
} from './_melhorEnvio.js';

// GET sem "code": o painel manda o navegador pra cá quando o admin clica em
// "Conectar Melhor Envio" - redireciona pra tela de autorização deles.
// GET com "code": é a própria Melhor Envio voltando depois que o admin
// autorizou - troca o código pelo par de tokens e redireciona de volta pro
// painel. Os dois casos usam o mesmo redirect_uri (esta mesma URL), exigido
// pelo OAuth2 - por isso um arquivo só cobre a ida e a volta.
//
// POST { action: 'calculate', toCep, items: [{category, qty}] } - público,
// usado pelo checkout para cotar frete real (Correios PAC/SEDEX).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method === 'GET') return handleOAuth(req, res);

  if (req.method === 'POST') {
    const body = readJsonBody(req);
    if (body.action === 'calculate') return handleCalculate(res, body);
    if (body.action === 'status') return sendJson(res, 200, await getConnectionStatus());
    return sendJson(res, 400, { error: 'Ação inválida.' });
  }

  return sendJson(res, 405, { error: 'Método não permitido.' });
}

function redirectUriFor(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}/api/shipping`;
}

async function handleOAuth(req, res) {
  const params = new URLSearchParams(req.url.split('?')[1] || '');
  const code = params.get('code');
  const redirectUri = redirectUriFor(req);

  if (!code) {
    try {
      res.writeHead(302, { Location: getOAuthAuthorizeUrl(redirectUri) });
      return res.end();
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  try {
    await exchangeCodeForTokens(code, redirectUri);
    res.writeHead(302, { Location: '/admin.html#configuracoes?melhor_envio=conectado' });
    return res.end();
  } catch (err) {
    res.writeHead(302, { Location: `/admin.html#configuracoes?melhor_envio=erro&msg=${encodeURIComponent(err.message)}` });
    return res.end();
  }
}

async function handleCalculate(res, body) {
  const { toCep, items } = body;
  if (!toCep || !Array.isArray(items) || !items.length) {
    return sendJson(res, 400, { error: 'Informe o CEP de destino e os itens do carrinho.' });
  }

  const { rows } = await sql`SELECT key, value FROM settings WHERE key IN ('store_info', 'shipping_config')`;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const storeInfo = map.store_info;
  const shippingConfig = map.shipping_config || {};

  if (!storeInfo?.cep) {
    return sendJson(res, 400, { error: 'A loja ainda não tem um CEP de origem cadastrado (Configurações > Dados da loja).' });
  }

  const totalWeightKg = computeTotalWeightKg(items, shippingConfig.categoryWeights);
  const packageDims = {
    width: shippingConfig.packageWidthCm || DEFAULT_PACKAGE_DIMS.width,
    height: shippingConfig.packageHeightCm || DEFAULT_PACKAGE_DIMS.height,
    length: shippingConfig.packageLengthCm || DEFAULT_PACKAGE_DIMS.length,
  };

  try {
    const options = await calculateShipping({ fromCep: storeInfo.cep, toCep, totalWeightKg, packageDims, insuranceValue: 0 });
    if (!options.length) {
      return sendJson(res, 200, { options: [], error: 'Nenhum serviço dos Correios disponível para este CEP no momento.' });
    }
    return sendJson(res, 200, { options });
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Não foi possível calcular o frete agora. Tente novamente em instantes.' });
  }
}
