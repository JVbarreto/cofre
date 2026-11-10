-- ============================================================
-- COFRE — Migration 005
-- 1) Remove políticas RLS redundantes (categorias, investimentos,
--    transacoes já têm "crud proprio" TO authenticated)
-- 2) Endurece contas_pagar no mesmo padrão das outras tabelas
-- Execute no SQL Editor do Supabase. É idempotente.
-- Requer PostgreSQL 15+ (ON DELETE SET NULL (coluna)).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Políticas redundantes (role public, sem SELECT auth.uid())
--    A política "<tabela>: crud proprio" (ALL, authenticated)
--    já cobre SELECT/INSERT/UPDATE/DELETE.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS categorias_select_own    ON public.categorias;
DROP POLICY IF EXISTS categorias_insert_own    ON public.categorias;
DROP POLICY IF EXISTS categorias_update_own    ON public.categorias;
DROP POLICY IF EXISTS categorias_delete_own    ON public.categorias;

DROP POLICY IF EXISTS investimentos_select_own ON public.investimentos;
DROP POLICY IF EXISTS investimentos_insert_own ON public.investimentos;
DROP POLICY IF EXISTS investimentos_update_own ON public.investimentos;
DROP POLICY IF EXISTS investimentos_delete_own ON public.investimentos;

DROP POLICY IF EXISTS transacoes_select_own    ON public.transacoes;
DROP POLICY IF EXISTS transacoes_insert_own    ON public.transacoes;
DROP POLICY IF EXISTS transacoes_update_own    ON public.transacoes;
DROP POLICY IF EXISTS transacoes_delete_own    ON public.transacoes;

-- ------------------------------------------------------------
-- 2. contas_pagar: política só para usuários logados
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "contas_pagar: crud proprio" ON public.contas_pagar;
CREATE POLICY "contas_pagar: crud proprio"
  ON public.contas_pagar FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Usuário anônimo não tem acesso a nada
REVOKE ALL ON public.contas_pagar FROM anon;

-- user_id não pode ser trocado depois de criado
DROP TRIGGER IF EXISTS trg_contas_pagar_bloquear_user_id ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_bloquear_user_id
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_troca_user_id();

-- A categoria de uma conta deve ser do mesmo usuário
ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_categoria_user_fkey;
ALTER TABLE public.contas_pagar
  ADD CONSTRAINT contas_pagar_categoria_user_fkey
  FOREIGN KEY (categoria_id, user_id)
  REFERENCES public.categorias (id, user_id)
  ON DELETE SET NULL (categoria_id);

COMMIT;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (rode depois, uma por vez)
-- Esperado: 1 política por tabela, todas {authenticated}
-- ------------------------------------------------------------
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- Esperado: nenhuma linha (anon sem acesso a nada)
-- SELECT table_name, string_agg(privilege_type, ', ')
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'anon' AND table_schema = 'public'
-- GROUP BY table_name;
