"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type InvestmentFormData = {
  name: string;
  asset_type: string;
  initial_value: string;
  current_value: string;
  purchase_date: string;
};

export type ActionResult = {
  success: boolean;
  errors?: Record<string, string>;
  message?: string;
};

const VALID_ASSET_TYPES = ["renda_fixa", "renda_variavel", "poupanca"] as const;

// ─── Validação ────────────────────────────────────────────────────────────────

function validateInvestment(data: InvestmentFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // Nome
  const name = data.name.trim();
  if (!name) {
    errors.name = "Nome do ativo é obrigatório.";
  } else if (name.length > 255) {
    errors.name = "Nome deve ter no máximo 255 caracteres.";
  }

  // Tipo de ativo
  if (!VALID_ASSET_TYPES.includes(data.asset_type as typeof VALID_ASSET_TYPES[number])) {
    errors.asset_type = "Classe de ativo inválida.";
  }

  // Valor inicial
  const initial = parseFloat(data.initial_value.replace(",", "."));
  if (isNaN(initial) || initial < 0) {
    errors.initial_value = "Valor investido deve ser zero ou positivo.";
  } else if (initial > 9_999_999_999.99) {
    errors.initial_value = "Valor excede o limite permitido.";
  }

  // Valor atual (opcional)
  if (data.current_value) {
    const current = parseFloat(data.current_value.replace(",", "."));
    if (isNaN(current) || current < 0) {
      errors.current_value = "Valor atual deve ser zero ou positivo.";
    } else if (current > 9_999_999_999.99) {
      errors.current_value = "Valor excede o limite permitido.";
    }
  }

  // Data de compra
  if (!data.purchase_date) {
    errors.purchase_date = "Data de compra é obrigatória.";
  } else {
    const parsed = new Date(data.purchase_date);
    if (isNaN(parsed.getTime())) {
      errors.purchase_date = "Data de compra inválida.";
    }
  }

  return errors;
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function createInvestment(data: InvestmentFormData): Promise<ActionResult> {
  // 1. Validação dos dados no servidor
  const errors = validateInvestment(data);
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // 2. Obter usuário autenticado diretamente do servidor
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const initial = parseFloat(data.initial_value.replace(",", "."));
  // valor_atual é NOT NULL no banco: sem valor informado, assume o valor aplicado
  const current = data.current_value
    ? parseFloat(data.current_value.replace(",", "."))
    : initial;

  // 3. Inserção segura no banco com user_id do servidor
  type InvestimentoInsert = Database["public"]["Tables"]["investimentos"]["Insert"];
  const payload: InvestimentoInsert = {
    user_id: user.id,
    nome: data.name.trim(),
    tipo: data.asset_type as InvestimentoInsert["tipo"],
    valor_aplicado: initial,
    valor_atual: current,
    data_aporte: data.purchase_date,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any).from("investimentos").insert(payload);

  if (dbError) {
    return {
      success: false,
      message: "Não foi possível salvar o ativo. Tente novamente.",
    };
  }

  return { success: true };
}
