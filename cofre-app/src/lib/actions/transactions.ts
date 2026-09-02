"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TransactionFormData = {
  description: string;
  amount: string;
  type: string;
  category_id: string;
  date: string;
  is_recurring: boolean;
  recurrence_rule: string;
  recurrence_end: string;
};

export type ActionResult = {
  success: boolean;
  errors?: Record<string, string>;
  message?: string;
};

// ─── Validação ────────────────────────────────────────────────────────────────

function validateTransaction(data: TransactionFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // Descrição
  const description = data.description.trim();
  if (!description) {
    errors.description = "Descrição é obrigatória.";
  } else if (description.length > 255) {
    errors.description = "Descrição deve ter no máximo 255 caracteres.";
  }

  // Tipo
  if (!["income", "expense"].includes(data.type)) {
    errors.type = "Tipo inválido. Use 'income' ou 'expense'.";
  }

  // Valor
  const amount = parseFloat(data.amount.replace(",", "."));
  if (isNaN(amount) || amount <= 0) {
    errors.amount = "Valor deve ser um número positivo.";
  } else if (amount > 9_999_999_999.99) {
    errors.amount = "Valor excede o limite permitido.";
  }

  // Data
  if (!data.date) {
    errors.date = "Data é obrigatória.";
  } else {
    const parsed = new Date(data.date);
    if (isNaN(parsed.getTime())) {
      errors.date = "Data inválida.";
    }
    // Bloqueia datas muito distantes no futuro (mais de 10 anos)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    if (parsed > maxDate) {
      errors.date = "Data não pode ser mais de 10 anos no futuro.";
    }
  }

  // Recorrência
  if (data.is_recurring) {
    if (!["monthly", "weekly"].includes(data.recurrence_rule)) {
      errors.recurrence_rule = "Frequência inválida.";
    }
    if (data.recurrence_end) {
      const endDate = new Date(data.recurrence_end);
      if (isNaN(endDate.getTime())) {
        errors.recurrence_end = "Data de encerramento inválida.";
      } else if (data.date && endDate <= new Date(data.date)) {
        errors.recurrence_end = "Data de encerramento deve ser posterior à data do lançamento.";
      }
    }
  }

  return errors;
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function createTransaction(data: TransactionFormData): Promise<ActionResult> {
  // 1. Validação dos dados no servidor
  const errors = validateTransaction(data);
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // 2. Obter usuário autenticado diretamente do servidor
  //    Nunca confiamos no user_id vindo do client
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // Sessão inválida — força logout e redireciona para login
    redirect("/login");
  }

  const amount = parseFloat(data.amount.replace(",", "."));

  // 3. Inserção segura no banco com user_id do servidor
  type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
  const payload: TransactionInsert = {
    user_id: user.id,
    description: data.description.trim(),
    amount,
    type: data.type as "income" | "expense",
    category_id: data.category_id || null,
    date: data.date,
    is_recurring: data.is_recurring,
    recurrence_rule: data.is_recurring
      ? (data.recurrence_rule as "monthly" | "weekly")
      : null,
    recurrence_end:
      data.is_recurring && data.recurrence_end ? data.recurrence_end : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any).from("transactions").insert(payload);

  if (dbError) {
    // Não expõe detalhes do banco para o client
    return {
      success: false,
      message: "Não foi possível salvar o lançamento. Tente novamente.",
    };
  }

  return { success: true };
}
