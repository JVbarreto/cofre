-- ============================================================
-- COFRE — Migration 003: Contas a Pagar / Anotações de Pagamento
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  titulo          text NOT NULL,
  descricao       text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  prazo           date NOT NULL,
  data_pagamento  date,
  importancia     text NOT NULL DEFAULT 'media' CHECK (importancia IN ('baixa', 'media', 'alta', 'urgente')),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  categoria_id    uuid,
  codigo_barras   text,
  forma_pagamento text DEFAULT 'boleto' CHECK (forma_pagamento IN ('pix', 'boleto', 'cartao', 'debito_automatico', 'dinheiro', 'outro')),
  recorrente      boolean DEFAULT false NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- Índices para buscas rápidas e ordenação
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user ON public.contas_pagar (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_prazo ON public.contas_pagar (prazo);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar (status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_importancia ON public.contas_pagar (importancia);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- Política de CRUD isolada por usuário
DROP POLICY IF EXISTS "contas_pagar: crud proprio" ON public.contas_pagar;
CREATE POLICY "contas_pagar: crud proprio"
  ON public.contas_pagar FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
