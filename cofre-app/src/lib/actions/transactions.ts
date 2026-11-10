"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";
import { TIPO_PARA_DB } from "@/lib/data/mappers";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TransactionFormData = {
  description: string;
  amount: string;
  type: string;
  category_id: string;
  date: string;
  is_recurring: boolean;
};

export type ActionResult = {
  success: boolean;
  errors?: Record<string, string>;
  message?: string;
};

// ─── Validação ────────────────────────────────────────────────────────────────

// Converte valor no formato brasileiro ("1.234,56") para número. Retorna NaN se inválido.
// Aceita apenas dígitos, pontos de milhar bem posicionados e vírgula decimal (até 2 casas).
function parseAmount(raw: string): number {
  const value = raw.trim();
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(value)) return NaN;
  return Number(value.replace(/\./g, "").replace(",", "."));
}

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
  const amount = parseAmount(data.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.amount = "Valor inválido. Use o formato 1.234,56.";
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

  const amount = parseAmount(data.amount);

  // 3. Inserção segura no banco com user_id do servidor
  type TransacaoInsert = Database["public"]["Tables"]["transacoes"]["Insert"];
  const payload: TransacaoInsert = {
    user_id: user.id,
    descricao: data.description.trim(),
    valor: amount,
    tipo: TIPO_PARA_DB[data.type as "income" | "expense"],
    categoria_id: data.category_id || null,
    data: data.date,
    recorrente: data.is_recurring,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any).from("transacoes").insert(payload);

  if (dbError) {
    // Não expõe detalhes do banco para o client
    return {
      success: false,
      message: "Não foi possível salvar o lançamento. Tente novamente.",
    };
  }

  return { success: true };
}

// ─── Atualização e exclusão ───────────────────────────────────────────────────

function revalidateTransactionPages() {
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function updateTransaction(id: string, data: TransactionFormData): Promise<ActionResult> {
  const errors = validateTransaction(data);
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  type TransacaoUpdate = Database["public"]["Tables"]["transacoes"]["Update"];
  const payload: TransacaoUpdate = {
    descricao: data.description.trim(),
    valor: parseAmount(data.amount),
    tipo: TIPO_PARA_DB[data.type as "income" | "expense"],
    categoria_id: data.category_id || null,
    data: data.date,
    recorrente: data.is_recurring,
  };

  const { data: updated, error: dbError } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("transacoes")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (dbError || !updated || updated.length === 0) {
    return {
      success: false,
      message: "Não foi possível atualizar o lançamento. Tente novamente.",
    };
  }

  revalidateTransactionPages();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: deleted, error: dbError } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("transacoes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (dbError || !deleted || deleted.length === 0) {
    return {
      success: false,
      message: "Não foi possível excluir o lançamento. Tente novamente.",
    };
  }

  revalidateTransactionPages();
  return { success: true };
}