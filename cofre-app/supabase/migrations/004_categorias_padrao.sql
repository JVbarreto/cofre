-- ============================================================
-- COFRE — Categorias padrão para novos usuários
-- Execute no SQL Editor do Supabase. É idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Função que cria as categorias iniciais de um usuário
--    SECURITY DEFINER com search_path fixo; não fica exposta via API.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_categorias_padrao(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categorias (user_id, nome, tipo, orcamento) VALUES
    (p_user_id, 'Salário',         'entrada',      NULL),
    (p_user_id, 'Freelance',       'entrada',      NULL),
    (p_user_id, 'Outras Receitas', 'entrada',      NULL),
    (p_user_id, 'Moradia',         'saida',        2000),
    (p_user_id, 'Alimentação',     'saida',        800),
    (p_user_id, 'Transporte',      'saida',        400),
    (p_user_id, 'Saúde',           'saida',        500),
    (p_user_id, 'Lazer',           'saida',        300),
    (p_user_id, 'Educação',        'saida',        200),
    (p_user_id, 'Assinaturas',     'saida',        100),
    (p_user_id, 'Outros Gastos',   'saida',        NULL),
    (p_user_id, 'Investimentos',   'investimento', NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_categorias_padrao(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Trigger no cadastro (auth.users)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.criar_categorias_padrao(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_novo_usuario() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_categorias ON auth.users;
CREATE TRIGGER on_auth_user_created_categorias
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_novo_usuario();

-- ------------------------------------------------------------
-- 3. Backfill: usuários já existentes que ainda não têm categorias
-- ------------------------------------------------------------
SELECT public.criar_categorias_padrao(u.id)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.user_id = u.id);

-- ------------------------------------------------------------
-- VERIFICAÇÃO
-- ------------------------------------------------------------
-- SELECT user_id, count(*) FROM public.categorias GROUP BY user_id;
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_categorias';
