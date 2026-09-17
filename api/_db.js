// Helpers compartilhados por todas as funções serverless em /api.
// `sql` vem do @vercel/postgres e lê a variável de ambiente POSTGRES_URL,
// criada automaticamente quando o banco Postgres é provisionado no painel
// da Vercel (aba Storage do projeto).
import { sql } from '@vercel/postgres';

export { sql };

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Trata o preflight de CORS. Retorna true se a requisição já foi respondida
// (nesse caso o handler que chamou deve parar por ali).
export function handlePreflight(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// req.body já vem parseado como objeto pelas funções Node da Vercel quando
// o Content-Type é application/json - este helper só cobre o caso raro de
// vir como string.
export function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function sendJson(res, statusCode, body) {
  res.status(statusCode).json(body);
}

// Extrai o :id de uma rota de segmento único (ex.: api/orders/[id].js).
// Não depende de req.query.<param> - nesse projeto (função Node "solta",
// sem Next.js) esse campo não vem preenchido de forma confiável quando a
// rota é reescrita internamente, então lemos req.url diretamente.
export function getIdFromUrl(req) {
  return req.url.split('?')[0].split('/').filter(Boolean).pop();
}
