-- ============================================================
-- COFRE — Security Fix Migration
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- ============================================================

-- ============================================================
-- FIX 1: Recriar handle_new_user_categories com SET search_path
-- Sem isso, funções SECURITY DEFINER são vulneráveis a
-- search_path injection (CVE padrão Postgres).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_default_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- FIX 2: Recriar create_default_categories com SET search_path
-- (garante que a função chamada internamente também é segura)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- ============================================================
-- FIX 3: Recriar views com security_invoker = on
--
-- Por padrão, views no PostgreSQL executam com os privilégios
-- do OWNER (security definer implícito), ignorando RLS do
-- usuário chamador. Com security_invoker = on, a view herda
-- as políticas RLS do usuário que faz a query — garantindo
-- que cada usuário só vê seus próprios dados mesmo via SQL direto.
-- ============================================================

-- Saldo por mes com security_invoker
CREATE OR REPLACE VIEW public.monthly_summary
  WITH (security_invoker = on)
AS
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

-- Gastos por categoria no mes com security_invoker
CREATE OR REPLACE VIEW public.category_monthly
  WITH (security_invoker = on)
AS
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
-- VERIFICAÇÃO (rode após aplicar para confirmar)
-- ============================================================
-- SELECT viewname, definition
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND viewname IN ('monthly_summary', 'category_monthly');
--
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname IN ('handle_new_user', 'handle_new_user_categories', 'create_default_categories')
--   AND pronamespace = 'public'::regnamespace;
