-- ====================================================================
-- EDUMODS FIIs — Esquema de Banco de Dados com Row Level Security (RLS)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ====================================================================

-- 1. Tabela de Posições em Carteira (Holdings)
CREATE TABLE IF NOT EXISTS public.fii_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    average_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    category VARCHAR(50) NOT NULL DEFAULT 'Tijolo',
    segment VARCHAR(50) NOT NULL DEFAULT 'Geral',
    notes TEXT DEFAULT '',
    target_percentage NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, ticker)
);

-- 2. Tabela de Operações / Transações (Compras, Vendas, Amortizações)
CREATE TABLE IF NOT EXISTS public.fii_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('COMPRA', 'VENDA', 'AMORTIZACAO', 'BONIFICACAO', 'SUBCRICAO')),
    date DATE NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    fees NUMERIC(15, 2) NOT NULL DEFAULT 0,
    broker VARCHAR(50) DEFAULT 'Padrão',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Proventos e Rendimentos (Dividends)
CREATE TABLE IF NOT EXISTS public.fii_dividends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    payment_date DATE NOT NULL,
    base_date DATE,
    value_per_share NUMERIC(15, 4) NOT NULL,
    total_value NUMERIC(15, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PAGO', 'PREVISTO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Metas Patrimoniais e Financeiras
CREATE TABLE IF NOT EXISTS public.fii_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_equity NUMERIC(15, 2) NOT NULL DEFAULT 100000.00,
    target_monthly_dividend NUMERIC(15, 2) NOT NULL DEFAULT 1000.00,
    target_monthly_investment NUMERIC(15, 2) NOT NULL DEFAULT 1500.00,
    target_years INTEGER NOT NULL DEFAULT 10,
    hide_values BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- 5. Tabela de Notas Estratégicas e Teses
CREATE TABLE IF NOT EXISTS public.fii_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic VARCHAR(50) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, topic)
);

-- ====================================================================
-- ATIVAÇÃO OBRIGATÓRIA DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ====================================================================
ALTER TABLE public.fii_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_notes ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- POLÍTICAS RLS PARA fii_holdings
-- ====================================================================
CREATE POLICY "Usuários só visualizam suas próprias posições"
ON public.fii_holdings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários só inserem posições para si mesmos"
ON public.fii_holdings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só atualizam suas próprias posições"
ON public.fii_holdings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só removem suas próprias posições"
ON public.fii_holdings FOR DELETE
USING (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS RLS PARA fii_transactions
-- ====================================================================
CREATE POLICY "Usuários só visualizam suas próprias transações"
ON public.fii_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários só inserem transações para si mesmos"
ON public.fii_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só atualizam suas próprias transações"
ON public.fii_transactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só removem suas próprias transações"
ON public.fii_transactions FOR DELETE
USING (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS RLS PARA fii_dividends
-- ====================================================================
CREATE POLICY "Usuários só visualizam seus próprios proventos"
ON public.fii_dividends FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários só inserem proventos para si mesmos"
ON public.fii_dividends FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só atualizam seus próprios proventos"
ON public.fii_dividends FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários só removem seus próprios proventos"
ON public.fii_dividends FOR DELETE
USING (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS RLS PARA fii_goals
-- ====================================================================
CREATE POLICY "Usuários só visualizam suas próprias metas"
ON public.fii_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários só inserem ou atualizam suas metas"
ON public.fii_goals FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- POLÍTICAS RLS PARA fii_notes
-- ====================================================================
CREATE POLICY "Usuários só visualizam suas próprias notas"
ON public.fii_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários só inserem ou atualizam suas notas"
ON public.fii_notes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Índices de Performance por user_id
CREATE INDEX IF NOT EXISTS idx_fii_holdings_user_id ON public.fii_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_fii_transactions_user_id ON public.fii_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fii_dividends_user_id ON public.fii_dividends(user_id);
