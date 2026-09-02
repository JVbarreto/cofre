-- ============================================================
-- COFRE — Migrations Supabase
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- ============================================================

-- ============================================================
-- 1. PROFILES (extensao do auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name       text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: leitura propria"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: atualizacao propria"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: cria perfil automaticamente no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('income', 'expense', 'investment')),
  color      text DEFAULT '#6c63ff',
  icon       text DEFAULT '📁',
  budget     numeric(12,2),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_categories_user ON public.categories (user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: crud proprio"
  ON public.categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categorias padrao para novos usuarios (inseridas via trigger)
CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type, color, icon, budget) VALUES
    (p_user_id, 'Salario',        'income',     '#22c55e', '💼', NULL),
    (p_user_id, 'Freelance',      'income',     '#10b981', '💻', NULL),
    (p_user_id, 'Outros Receitas','income',     '#34d399', '➕', NULL),
    (p_user_id, 'Moradia',        'expense',    '#ef4444', '🏠', 2000),
    (p_user_id, 'Alimentacao',    'expense',    '#f59e0b', '🛒', 800),
    (p_user_id, 'Transporte',     'expense',    '#3b82f6', '🚗', 400),
    (p_user_id, 'Saude',          'expense',    '#a855f7', '💊', 500),
    (p_user_id, 'Lazer',          'expense',    '#ec4899', '🎬', 300),
    (p_user_id, 'Educacao',       'expense',    '#06b6d4', '📚', 200),
    (p_user_id, 'Assinaturas',    'expense',    '#8b5cf6', '📱', 100),
    (p_user_id, 'Outros Gastos',  'expense',    '#6b7280', '📦', NULL),
    (p_user_id, 'Investimentos',  'investment', '#6c63ff', '📈', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.create_default_categories(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_categories();

-- ============================================================
-- 3. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  category_id       uuid REFERENCES public.categories ON DELETE SET NULL,
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  type              text NOT NULL CHECK (type IN ('income', 'expense')),
  date              date NOT NULL,
  description       text NOT NULL,
  is_recurring      boolean DEFAULT false NOT NULL,
  recurrence_rule   text CHECK (recurrence_rule IN ('monthly', 'weekly', NULL)),
  recurrence_end    date,
  parent_id         uuid REFERENCES public.transactions ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_transactions_user       ON public.transactions (user_id);
CREATE INDEX idx_transactions_date       ON public.transactions (date DESC);
CREATE INDEX idx_transactions_user_date  ON public.transactions (user_id, date DESC);
CREATE INDEX idx_transactions_category   ON public.transactions (category_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: crud proprio"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. INVESTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  asset_type     text NOT NULL CHECK (asset_type IN ('renda_fixa','acoes','fundos','cripto','outros')),
  institution    text,
  initial_value  numeric(12,2) NOT NULL CHECK (initial_value >= 0),
  current_value  numeric(12,2),
  purchase_date  date NOT NULL,
  maturity_date  date,
  notes          text,
  is_active      boolean DEFAULT true NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_investments_user ON public.investments (user_id);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investments: crud proprio"
  ON public.investments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. INVESTMENT_SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investment_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id  uuid REFERENCES public.investments ON DELETE CASCADE NOT NULL,
  user_id        uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  value          numeric(12,2) NOT NULL,
  recorded_at    date NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (investment_id, recorded_at)
);

CREATE INDEX idx_snapshots_investment ON public.investment_snapshots (investment_id, recorded_at DESC);

ALTER TABLE public.investment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: crud proprio"
  ON public.investment_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VIEWS UTEIS
-- ============================================================

-- Saldo por mes (receitas, despesas, saldo liquido)
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date)::date AS month,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
  SUM(CASE WHEN type = 'income'  THEN amount
           WHEN type = 'expense' THEN -amount
           ELSE 0 END) AS net
FROM public.transactions
GROUP BY user_id, DATE_TRUNC('month', date);

-- Gastos por categoria no mes
CREATE OR REPLACE VIEW public.category_monthly AS
SELECT
  t.user_id,
  t.category_id,
  c.name    AS category_name,
  c.color   AS category_color,
  c.icon    AS category_icon,
  c.budget  AS category_budget,
  DATE_TRUNC('month', t.date)::date AS month,
  SUM(t.amount) AS total
FROM public.transactions t
JOIN public.categories c ON c.id = t.category_id
WHERE t.type = 'expense'
GROUP BY t.user_id, t.category_id, c.name, c.color, c.icon, c.budget, DATE_TRUNC('month', t.date);

-- ============================================================
-- FIM DAS MIGRATIONS
-- ============================================================
