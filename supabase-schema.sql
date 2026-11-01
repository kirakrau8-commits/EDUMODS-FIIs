-- =============================================================================
-- EDUMODS FIIs — SCHEMA COMPLETO PARA USO PESSOAL + WEB PUSH EM SEGUNDO PLANO
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabelas Principais da Carteira (Uso Pessoal sem Login)
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

-- 2. Tabelas do Sistema de Web Push e Monitoramento Automático no Servidor
CREATE TABLE IF NOT EXISTS public.fii_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    fail_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT DEFAULT NULL,
    last_success_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    notification_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'oportunidade',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    ticker TEXT DEFAULT NULL,
    channel TEXT NOT NULL DEFAULT 'web_push_background',
    delivered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fii_monitoring_state (
    user_id UUID PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    last_monitor_run_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_quote_update_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    quote_source TEXT DEFAULT 'B3 Tempo Real',
    is_fallback_data BOOLEAN NOT NULL DEFAULT false,
    evaluated_count INTEGER NOT NULL DEFAULT 0,
    triggered_count INTEGER NOT NULL DEFAULT 0,
    pushed_count INTEGER NOT NULL DEFAULT 0,
    last_status TEXT NOT NULL DEFAULT 'ok',
    last_error TEXT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices Únicos
CREATE UNIQUE INDEX IF NOT EXISTS fii_user_profiles_user_id_uidx ON public.fii_user_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_holdings_user_id_ticker_uidx ON public.fii_holdings (user_id, ticker);
CREATE UNIQUE INDEX IF NOT EXISTS fii_goals_user_id_uidx ON public.fii_goals (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS fii_notes_user_id_topic_uidx ON public.fii_notes (user_id, topic);
CREATE UNIQUE INDEX IF NOT EXISTS fii_push_subscriptions_endpoint_uidx ON public.fii_push_subscriptions (endpoint);
CREATE UNIQUE INDEX IF NOT EXISTS fii_notification_logs_user_notif_uidx ON public.fii_notification_logs (user_id, notification_id);

-- 4. Row Level Security (RLS)
ALTER TABLE public.fii_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fii_monitoring_state ENABLE ROW LEVEL SECURITY;

-- Políticas de Uso Pessoal para tabelas da carteira
CREATE POLICY "fii_user_profiles_personal_all" ON public.fii_user_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_holdings_personal_all" ON public.fii_holdings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_transactions_personal_all" ON public.fii_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_dividends_personal_all" ON public.fii_dividends FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_goals_personal_all" ON public.fii_goals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_notes_personal_all" ON public.fii_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Políticas para Histórico de Notificações e Status de Monitoramento (não contêm chaves ou credenciais)
CREATE POLICY "fii_notification_logs_personal_all" ON public.fii_notification_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fii_monitoring_state_personal_select" ON public.fii_monitoring_state FOR SELECT TO anon, authenticated USING (true);

-- SEGURANÇA ESTRITA: Inscrições Push (fii_push_subscriptions) contêm endpoints e chaves criptográficas (p256dh/auth).
-- NENHUMA política pública (anon/authenticated) é criada em fii_push_subscriptions!
-- O acesso direto à tabela fii_push_subscriptions é exclusivo do servidor via service_role.
REVOKE ALL ON public.fii_push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.fii_push_subscriptions TO service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_user_profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_holdings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_transactions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_dividends TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_goals TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_notes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fii_notification_logs TO anon, authenticated, service_role;
GRANT SELECT ON public.fii_monitoring_state TO anon, authenticated;
GRANT ALL ON public.fii_monitoring_state TO service_role;

COMMIT;
