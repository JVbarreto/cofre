"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type InvestmentFormData = {
  name: string;
  asset_type: string;
  institution: string;
  initial_value: string;
  current_value: string;
  purchase_date: string;
  maturity_date: string;
  notes: string;
};

export type ActionResult = {
  success: boolean;
  errors?: Record<string, string>;
  message?: string;
};

const VALID_ASSET_TYPES = ["renda_fixa", "acoes", "fundos", "cripto", "outros"] as const;

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

  // Instituição
  if (data.institution && data.institution.trim().length > 255) {
    errors.institution = "Instituição deve ter no máximo 255 caracteres.";
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

  // Vencimento (opcional)
  if (data.maturity_date) {
    const maturity = new Date(data.maturity_date);
    if (isNaN(maturity.getTime())) {
      errors.maturity_date = "Data de vencimento inválida.";
    } else if (data.purchase_date && maturity <= new Date(data.purchase_date)) {
      errors.maturity_date = "Vencimento deve ser posterior à data de compra.";
    }
  }

  // Observações
  if (data.notes && data.notes.trim().length > 2000) {
    errors.notes = "Observações devem ter no máximo 2000 caracteres.";
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
  const current = data.current_value
    ? parseFloat(data.current_value.replace(",", "."))
    : null;

  // 3. Inserção segura no banco com user_id do servidor
  type InvestmentInsert = Database["public"]["Tables"]["investments"]["Insert"];
  const payload: InvestmentInsert = {
    user_id: user.id,
    name: data.name.trim(),
    asset_type: data.asset_type as InvestmentInsert["asset_type"],
    institution: data.institution.trim() || null,
    initial_value: initial,
    current_value: current,
    purchase_date: data.purchase_date,
    maturity_date: data.maturity_date || null,
    notes: data.notes.trim() || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any).from("investments").insert(payload);

  if (dbError) {
    return {
      success: false,
      message: "Não foi possível salvar o ativo. Tente novamente.",
    };
  }

  return { success: true };
}
