"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

export type ActionResult = {
  success: boolean;
  message?: string;
};

function revalidateContasPages() {
  revalidatePath("/contas-a-pagar");
  revalidatePath("/dashboard");
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function registrarPagamento(
  contaId: string,
  valor: number,
  pagoEm?: string
): Promise<ActionResult> {
  if (!contaId || typeof contaId !== "string" || !contaId.trim()) {
    return { success: false, message: "Conta inválida." };
  }

  const numValor = Number(valor);
  const roundedValor = Math.round(numValor * 100) / 100;
  if (!Number.isFinite(numValor) || roundedValor < 0.01) {
    return {
      success: false,
      message: "O valor do pagamento deve ser de pelo menos R$ 0,01.",
    };
  }

  const trimmedDate = pagoEm?.trim();
  if (trimmedDate && !isValidIsoDate(trimmedDate)) {
    return {
      success: false,
      message: "Data do pagamento inválida.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  type PagamentoInsert = Database["public"]["Tables"]["pagamentos_conta"]["Insert"];
  const payload: PagamentoInsert = {
    conta_id: contaId.trim(),
    user_id: user.id,
    valor: roundedValor,
    ...(trimmedDate ? { pago_em: trimmedDate } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any)
    .from("pagamentos_conta")
    .insert(payload);

  if (dbError) {
    return {
      success: false,
      message: dbError.message || "Não foi possível registrar o pagamento.",
    };
  }

  revalidateContasPages();
  return { success: true };
}

export async function desfazerPagamento(pagamentoId: string): Promise<ActionResult> {
  if (!pagamentoId || typeof pagamentoId !== "string" || !pagamentoId.trim()) {
    return { success: false, message: "Pagamento inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deleted, error: dbError } = await (supabase as any)
    .from("pagamentos_conta")
    .delete()
    .eq("id", pagamentoId.trim())
    .eq("user_id", user.id)
    .select("id");

  if (dbError) {
    return {
      success: false,
      message: dbError.message || "Não foi possível desfazer o pagamento.",
    };
  }

  if (!deleted || deleted.length === 0) {
    return {
      success: false,
      message: "Pagamento não encontrado.",
    };
  }

  revalidateContasPages();
  return { success: true };
}

