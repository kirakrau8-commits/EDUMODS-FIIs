-- =============================================================================
-- EDUMODS FIIs — SCHEMA COMPLETO PARA USO PESSOAL (SEM DEPENDÊNCIA DE LOGIN AUTH)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE UNIQUE INDEX IF NOT EXISTS fii_user_profiles_user_id_uidx ON public.fii_user_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_holdings_user_id_ticker_uidx ON public.fii_holdings (user_id, ticker);
CREATE UNIQUE INDEX IF NOT EXISTS fii_goals_user_id_uidx ON public.fii_goals (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_notes_user_id_topic_uidx ON public.fii_notes (user_id, topic);

ALTER TABLE public.fii_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fii_user_profiles_personal_all" ON public.fii_user_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_holdings_personal_all" ON public.fii_holdings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_transactions_personal_all" ON public.fii_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_dividends_personal_all" ON public.fii_dividends FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_goals_personal_all" ON public.fii_goals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_notes_personal_all" ON public.fii_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_user_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_holdings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_dividends TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_goals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_notes TO anon, authenticated;

COMMIT;
