import { createClient } from "@/lib/supabase/server";
import type { TransactionWithCategory, TransacaoRow, CategoriaRow } from "@/types/database";
import { mapTransacaoComCategoria } from "@/lib/data/mappers";
import { formatBRL } from "@/lib/utils/currency";
import { formatMonth, getCurrentMonthRange } from "@/lib/utils/dates";
import Link from "next/link";
import { Plus } from "lucide-react";

// "2026-10-05" -> "05/10", sem passar por Date (evita deslocar o dia por fuso horário)
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default async function LancamentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { start, end } = getCurrentMonthRange();

  const { data: transacoesRaw } = await supabase
    .from("transacoes")
    .select("*, categoria:categorias(*)")
    .eq("user_id", user!.id)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false }) as unknown as { data: (TransacaoRow & { categoria: CategoriaRow | null })[] | null };
  const transactions: TransactionWithCategory[] | null = transacoesRaw?.map(mapTransacaoComCategoria) ?? null;

  const list = transactions ?? [];
  const totalIncome  = list.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = list.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{formatMonth(new Date())}</div>
          <h1 className="h1">Lançamentos</h1>
        </div>
        <Link href="/lancamentos/novo" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Novo lançamento
        </Link>
      </header>

      <section className="section" aria-label="Lançamentos do mês">
        <p className="muted">
          {list.length} {list.length === 1 ? "lançamento" : "lançamentos"} ·{" "}
          <span className="amount-in num">{formatBRL(totalIncome)}</span> de entrada ·{" "}
          <span className="amount-out num">{formatBRL(totalExpense)}</span> de saída
        </p>

        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nenhum lançamento neste mês</div>
            <p>Registre uma entrada ou saída para começar o livro-caixa de {formatMonth(new Date())}.</p>
            <Link href="/lancamentos/novo" className="btn btn-ghost">Novo lançamento</Link>
          </div>
        ) : (
          <div className="table-responsive">
            <div className="table cols-tx">
              <div className="table-head">
                <div>Data</div><div>Descrição</div><div>Categoria</div><div>Tipo</div><div className="num">Valor</div>
              </div>
              {list.map(t => (
                <div key={t.id} className="table-row">
                  <div className="muted num" style={{ textAlign: "left" }}>{dayMonth(t.date)}</div>
                  <div className="strong">
                    {t.description}
                    {t.is_recurring && <span className="badge" style={{ marginLeft: "var(--sp-2)" }}>recorrente</span>}
                  </div>
                  <div className="muted">{t.category?.name ?? "Sem categoria"}</div>
                  <div className={t.type === "income" ? "amount-in" : "amount-out"}>
                    {t.type === "income" ? "Entrada" : "Saída"}
                  </div>
                  <div className={`num ${t.type === "income" ? "amount-in" : "amount-out"}`}>
                    {t.type === "income" ? "" : "− "}{formatBRL(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
