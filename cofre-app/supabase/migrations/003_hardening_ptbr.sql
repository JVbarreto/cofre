-- ============================================================
-- COFRE — Hardening + views (schema em português)
-- Execute no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- Pré-requisito: tabelas categorias, transacoes e investimentos já criadas.
-- Requer PostgreSQL 15+ (padrão atual do Supabase) por causa do
-- "ON DELETE SET NULL (coluna)" na FK composta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Função usada pelos triggers trg_*_bloquear_user_id
--    (não estava no schema enviado; recriada com search_path fixo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_troca_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bloquear_troca_user_id() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Coluna de orçamento por categoria (usada em "Metas do mês")
-- ------------------------------------------------------------
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS orcamento numeric(12,2) CHECK (orcamento IS NULL OR orcamento >= 0);

-- ------------------------------------------------------------
-- 3. Row Level Security — cada usuário só acessa os próprios dados
-- ------------------------------------------------------------
ALTER TABLE public.categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias: crud proprio" ON public.categorias;
CREATE POLICY "categorias: crud proprio"
  ON public.categorias FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "transacoes: crud proprio" ON public.transacoes;
CREATE POLICY "transacoes: crud proprio"
  ON public.transacoes FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "investimentos: crud proprio" ON public.investimentos;
CREATE POLICY "investimentos: crud proprio"
  ON public.investimentos FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Usuários anônimos não têm acesso a nada
REVOKE ALL ON public.categorias, public.transacoes, public.investimentos FROM anon;

-- ------------------------------------------------------------
-- 4. Integridade: a categoria de uma transação deve ser do mesmo usuário
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categorias_id_user_id_key'
  ) THEN
    ALTER TABLE public.categorias
      ADD CONSTRAINT categorias_id_user_id_key UNIQUE (id, user_id);
  END IF;
END $$;

ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_categoria_id_fkey;
ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_categoria_user_fkey;
ALTER TABLE public.transacoes
  ADD CONSTRAINT transacoes_categoria_user_fkey
  FOREIGN KEY (categoria_id, user_id)
  REFERENCES public.categorias (id, user_id)
  ON DELETE SET NULL (categoria_id);

-- ------------------------------------------------------------
-- 5. Views (todas com security_invoker => respeitam o RLS do usuário)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.media_gastos_recorrentes
  WITH (security_invoker = on)
AS
SELECT
  t.user_id,
  c.nome AS categoria,
  round(avg(t.valor), 2) AS media_mensal
FROM public.transacoes t
JOIN public.categorias c ON c.id = t.categoria_id
WHERE t.tipo = 'saida' AND t.recorrente = true
GROUP BY t.user_id, c.nome;

CREATE OR REPLACE VIEW public.resumo_mensal
  WITH (security_invoker = on)
AS
SELECT
  user_id,
  date_trunc('month', data)::date AS mes,
  sum(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS total_entradas,
  sum(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END) AS total_saidas,
  sum(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) AS saldo
FROM public.transacoes
GROUP BY user_id, date_trunc('month', data);

CREATE OR REPLACE VIEW public.gastos_categoria_mensal
  WITH (security_invoker = on)
AS
SELECT
  t.user_id,
  t.categoria_id,
  COALESCE(c.nome, 'Sem categoria') AS categoria_nome,
  c.orcamento                       AS categoria_orcamento,
  date_trunc('month', t.data)::date AS mes,
  sum(t.valor)                      AS total
FROM public.transacoes t
LEFT JOIN public.categorias c ON c.id = t.categoria_id
WHERE t.tipo = 'saida'
GROUP BY t.user_id, t.categoria_id, c.nome, c.orcamento, date_trunc('month', t.data);

REVOKE ALL ON public.media_gastos_recorrentes,
              public.resumo_mensal,
              public.gastos_categoria_mensal FROM anon;
GRANT SELECT ON public.media_gastos_recorrentes,
                public.resumo_mensal,
                public.gastos_categoria_mensal TO authenticated;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (rode após aplicar)
-- ------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname = 'public';
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public';
-- SELECT relname, reloptions FROM pg_class
--  WHERE relname IN ('media_gastos_recorrentes','resumo_mensal','gastos_categoria_mensal');
