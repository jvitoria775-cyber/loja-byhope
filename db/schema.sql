-- Schema do banco compartilhado da Gratitude Têxtil (Vercel Postgres / Neon).
-- Rode este arquivo UMA VEZ no editor de query do Postgres (aba Storage do
-- projeto na Vercel, ou no console da Neon) depois de provisionar o banco.
--
-- Cada tabela guarda o mesmo formato de objeto que o app já usava no
-- localStorage, dentro de uma coluna JSONB — migração de baixo risco, sem
-- precisar redesenhar tudo em formato relacional. Colunas extras fora do
-- JSONB existem só para filtro/índice rápido.

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  data                JSONB NOT NULL,
  channel             TEXT,
  status              TEXT,
  fulfillment_status  TEXT,
  customer_email      TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_is_demo_idx ON orders (is_demo);

CREATE TABLE IF NOT EXISTS manual_customers (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_overrides (
  product_id  TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_products (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

-- Valores padrão: desconto geral de 27% já ativo, dados da loja em branco
-- (sem inventar CNPJ/endereço), lista de produtos ocultos vazia.
--
-- O PIN inicial ("2026") NÃO é inserido aqui de propósito: calcular o hash
-- à mão e colar num INSERT é frágil (fácil de errar um parâmetro do PBKDF2
-- e travar o acesso). Em vez disso, api/auth.js aceita o PIN padrão "2026"
-- no primeiro login (quando não existe 'admin_pin_hash' ainda) e já grava o
-- hash correto nesse momento, calculado pela própria função Node - sem
-- risco de incompatibilidade entre implementações.
INSERT INTO settings (key, value) VALUES
  ('store_discount_percent', '27'),
  ('store_info', '{"name":"","cnpj":"","email":"","phone":"","cep":"","street":"","number":"","city":"","state":""}'),
  ('hidden_products', '[]')
ON CONFLICT (key) DO NOTHING;
