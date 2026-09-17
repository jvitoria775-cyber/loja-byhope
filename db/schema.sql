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

-- ---------------------------------------------------------------------
-- Segunda etapa: clientes atacadistas com preço diferenciado.
-- product_overrides.data ganha um campo novo "wholesaleTiers"
-- ({tier1, tier2, tier3}, só tier1 usado por enquanto) - não precisa de
-- migração de schema porque a coluna já é JSONB (sem forma fixa).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wholesale_customers (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  doc_type       TEXT NOT NULL,        -- 'cpf' | 'cnpj'
  doc_number     TEXT NOT NULL UNIQUE, -- só dígitos
  data           JSONB NOT NULL,       -- fullName, storeName, phone, address{cep,street,number,complement,neighborhood,city,state}
  status         TEXT NOT NULL DEFAULT 'active', -- pronto para 'pending'/'blocked' no futuro, sem uso agora
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  token       TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES wholesale_customers(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
