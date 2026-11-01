-- =============================================================================
-- EDUMODS FIIs — MIGRAÇÃO SQL PARA MODO DE USO PESSOAL (SEM EXIGIR LOGIN AUTH)
-- =============================================================================
-- OBJETIVO:
-- 1. Preservar integralmente as 6 tabelas antigas (profiles, portfolios, funds,
--    transactions, payments, portfolio_snapshots) e seus dados.
-- 2. Criar/atualizar as 6 tabelas fii_* (fii_user_profiles, fii_holdings,
--    fii_transactions, fii_dividends, fii_goals, fii_notes) para uso pessoal
--    sem exigir login (Supabase Auth), utilizando o UUID pessoal fixo
--    '00000000-0000-4000-8000-000000000001' (ou o UUID já existente no banco).
-- 3. Liberar 100% dos recursos (plan = 'VIP', role = 'admin') para uso pessoal.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. CRIAÇÃO / EVOLUÇÃO DAS 6 TABELAS fii_* (SEM DEPENDÊNCIA DE auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fii_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    full_name TEXT DEFAULT 'Eduardo',
    plan TEXT NOT NULL DEFAULT 'VIP',
    role TEXT NOT NULL DEFAULT 'admin',
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_initialized BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    ticker TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    average_price NUMERIC NOT NULL DEFAULT 0 CHECK (average_price >= 0),
    category TEXT NOT NULL DEFAULT 'Tijolo',
    segment TEXT NOT NULL DEFAULT 'Outros',
    notes TEXT DEFAULT '',
    target_percentage NUMERIC DEFAULT 10,
    is_favorite BOOLEAN DEFAULT false,
    name TEXT,
    current_price NUMERIC,
    vpa NUMERIC,
    last_dividend NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL,
    date DATE NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    price NUMERIC NOT NULL CHECK (price >= 0),
    fees NUMERIC NOT NULL DEFAULT 0 CHECK (fees >= 0),
    realized_result NUMERIC DEFAULT NULL,
    broker TEXT DEFAULT 'B3 Oficial',
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_dividends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    ticker TEXT NOT NULL,
    payment_date DATE NOT NULL,
    base_date DATE,
    quantity_eligible NUMERIC DEFAULT 0,
    value_per_share NUMERIC NOT NULL CHECK (value_per_share >= 0),
    total_value NUMERIC NOT NULL CHECK (total_value >= 0),
    status TEXT NOT NULL DEFAULT 'PAGO',
    is_manual BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    target_equity NUMERIC NOT NULL DEFAULT 500000,
    target_monthly_dividend NUMERIC NOT NULL DEFAULT 5000,
    current_living_expenses NUMERIC DEFAULT 4500,
    fire_safe_yield_percent NUMERIC DEFAULT 9.5,
    hide_values BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    topic TEXT NOT NULL DEFAULT 'geral',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 2. REMOÇÃO DE FOREIGN KEYS PARA auth.users NAS TABELAS fii_* (MODO SEM LOGIN)
-- =============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name IN (
              'fii_user_profiles',
              'fii_holdings',
              'fii_transactions',
              'fii_dividends',
              'fii_goals',
              'fii_notes'
          )
          AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;

-- Remove trigger antiga de bloqueio de plano para liberar plano VIP no uso pessoal
DROP TRIGGER IF EXISTS trg_protect_fii_user_profile_admin_fields ON public.fii_user_profiles;

-- =============================================================================
-- 3. GARANTIA DE COLUNAS E CONSTRAINTS
-- =============================================================================
ALTER TABLE public.fii_user_profiles
    ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'Eduardo',
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'VIP',
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_initialized BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.fii_holdings
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Tijolo',
    ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'Outros',
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS target_percentage NUMERIC DEFAULT 10,
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS current_price NUMERIC,
    ADD COLUMN IF NOT EXISTS vpa NUMERIC,
    ADD COLUMN IF NOT EXISTS last_dividend NUMERIC,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.fii_transactions
    ADD COLUMN IF NOT EXISTS fees NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS realized_result NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS broker TEXT DEFAULT 'B3 Oficial',
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.fii_dividends
    ADD COLUMN IF NOT EXISTS base_date DATE,
    ADD COLUMN IF NOT EXISTS quantity_eligible NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PAGO',
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.fii_goals
    ADD COLUMN IF NOT EXISTS target_equity NUMERIC NOT NULL DEFAULT 500000,
    ADD COLUMN IF NOT EXISTS target_monthly_dividend NUMERIC NOT NULL DEFAULT 5000,
    ADD COLUMN IF NOT EXISTS current_living_expenses NUMERIC DEFAULT 4500,
    ADD COLUMN IF NOT EXISTS fire_safe_yield_percent NUMERIC DEFAULT 9.5,
    ADD COLUMN IF NOT EXISTS hide_values BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.fii_notes
    ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'geral',
    ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- =============================================================================
-- 4. CONSOLIDAÇÃO DE REGISTROS DUPLICADOS E ÍNDICES UNIQUE PARA UPSERT
-- =============================================================================
DO $$
BEGIN
    WITH ranked_profiles AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM public.fii_user_profiles
    )
    DELETE FROM public.fii_user_profiles
    WHERE id IN (SELECT id FROM ranked_profiles WHERE rn > 1);
END $$;

DO $$
BEGIN
    WITH ranked_goals AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM public.fii_goals
    )
    DELETE FROM public.fii_goals
    WHERE id IN (SELECT id FROM ranked_goals WHERE rn > 1);
END $$;

DO $$
BEGIN
    WITH ranked_holdings AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, ticker
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM public.fii_holdings
    )
    DELETE FROM public.fii_holdings
    WHERE id IN (SELECT id FROM ranked_holdings WHERE rn > 1);
END $$;

DO $$
BEGIN
    WITH ranked_notes AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, topic
                   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM public.fii_notes
    )
    DELETE FROM public.fii_notes
    WHERE id IN (SELECT id FROM ranked_notes WHERE rn > 1);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS fii_user_profiles_user_id_uidx ON public.fii_user_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_holdings_user_id_ticker_uidx ON public.fii_holdings (user_id, ticker);
CREATE UNIQUE INDEX IF NOT EXISTS fii_goals_user_id_uidx ON public.fii_goals (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_notes_user_id_topic_uidx ON public.fii_notes (user_id, topic);

-- =============================================================================
-- 5. PERFIL PESSOAL PADRÃO COM ACESSO TOTAL LIBERADO (VIP / ADMIN)
-- =============================================================================
INSERT INTO public.fii_user_profiles (user_id, full_name, plan, role, preferences, is_initialized)
VALUES (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'Eduardo',
    'VIP',
    'admin',
    '{}'::jsonb,
    true
)
ON CONFLICT (user_id) DO UPDATE SET
    plan = 'VIP',
    role = 'admin',
    updated_at = timezone('utc'::text, now());

-- Atualiza qualquer perfil já existente para VIP / admin (uso pessoal liberado)
UPDATE public.fii_user_profiles
SET plan = 'VIP', role = 'admin', updated_at = timezone('utc'::text, now());

-- =============================================================================
-- 6. POLÍTICAS RLS PARA MODO PESSOAL (ACESSO DIRETO SEM LOGIN)
-- =============================================================================
ALTER TABLE public.fii_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'fii_user_profiles',
              'fii_holdings',
              'fii_transactions',
              'fii_dividends',
              'fii_goals',
              'fii_notes'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Políticas para uso pessoal exclusivo (permite operação sem sessão Supabase Auth)
CREATE POLICY "fii_user_profiles_personal_all"
    ON public.fii_user_profiles
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "fii_holdings_personal_all"
    ON public.fii_holdings
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "fii_transactions_personal_all"
    ON public.fii_transactions
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "fii_dividends_personal_all"
    ON public.fii_dividends
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "fii_goals_personal_all"
    ON public.fii_goals
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "fii_notes_personal_all"
    ON public.fii_notes
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_user_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_holdings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_dividends TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_goals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_notes TO anon, authenticated;

COMMIT;
