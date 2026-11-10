import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TransacaoRow } from "@/types/database";
import TransactionForm from "@/components/lancamentos/TransactionForm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data } = await supabase
    .from("transacoes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle() as unknown as { data: TransacaoRow | null };

  if (!data) notFound();

  return (
    <TransactionForm
      transactionId={data.id}
      initial={{
        description: data.descricao,
        amount: Number(data.valor).toFixed(2).replace(".", ","),
        type: data.tipo === "entrada" ? "income" : "expense",
        category_id: data.categoria_id ?? "",
        date: data.data,
        is_recurring: data.recorrente,
      }}
    />
  );
}