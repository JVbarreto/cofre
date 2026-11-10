import { createClient } from "@/lib/supabase/server";
import type { TransactionWithCategory, TransacaoRow, CategoriaRow } from "@/types/database";
import { mapTransacaoComCategoria } from "@/lib/data/mappers";
import { formatBRL } from "@/lib/utils/currency";
import { formatMonth, getCurrentMonthRange } from "@/lib/utils/dates";
import Link from "next/link";
import { Plus, ArrowDownLeft, ArrowUpRight, Pencil } from "lucide-react";
import DeleteTransactionButton from "@/components/lancamentos/DeleteTransactionButton";

// "2026-10-05" -> "05/10/2026", sem passar por Date (evita deslocar o dia por fuso horário)
const fullDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const netBalance   = totalIncome - totalExpense;
  const monthLabel   = cap(formatMonth(new Date()));

  return (
    <div className="page">
      <header className="page-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="h1">Lançamentos</h1>
          <p className="page-sub only-d">Histórico de movimentações em {monthLabel}</p>
        </div>
        <Link href="/lancamentos/novo" className="btn btn-primary" style={{ borderRadius: "var(--radius-md)", width: "auto" }}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span className="only-d">Novo Lançamento</span>
          <span className="only-m">Lançar</span>
        </Link>
      </header>

      {/* Resumo Rápido */}
      <div className="summary-row" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <section className="summary-card" style={{ padding: "var(--sp-4)", gap: 6 }}>
          <span className="summary-card-label">Receitas</span>
          <span className="num summary-card-value amount-in" style={{ fontSize: "1.25rem" }}>+ {formatBRL(totalIncome)}</span>
        </section>
        <section className="summary-card" style={{ padding: "var(--sp-4)", gap: 6 }}>
          <span className="summary-card-label">Despesas</span>
          <span className="num summary-card-value amount-out" style={{ fontSize: "1.25rem" }}>− {formatBRL(totalExpense)}</span>
        </section>
        <section className="summary-card" style={{ padding: "var(--sp-4)", gap: 6 }}>
          <span className="summary-card-label">Saldo do Mês</span>
          <span className="num summary-card-value" style={{ fontSize: "1.25rem", color: netBalance >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
            {formatBRL(netBalance)}
          </span>
        </section>
      </div>

      <section className="section" aria-label="Lista de lançamentos">
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nenhum lançamento neste mês</div>
            <p>Registre uma entrada ou saída para começar o livro-caixa de {monthLabel}.</p>
            <Link href="/lancamentos/novo" className="btn btn-ghost">Novo lançamento</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {list.map(t => {
              const isIn = t.type === "income";
              return (
                <div key={t.id} className="entry-row">
                  <div className="entry-left">
                    <span className={`entry-icon ${isIn ? "in" : "out"}`} aria-hidden="true">
                      {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="entry-desc">{t.description}</div>
                      <div className="entry-meta">
                        {t.category?.name ?? "Sem categoria"} • {fullDate(t.date)}
                        {t.is_recurring && <span className="pill-sm" style={{ marginLeft: 6 }}>recorrente</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                    <div className={`num entry-val ${isIn ? "amount-in" : "amount-out"}`}>
                      {isIn ? "+" : "−"} {formatBRL(t.amount)}
                    </div>
                    <Link href={`/lancamentos/${t.id}/editar`} className="icon-btn" aria-label={`Editar ${t.description}`} title="Editar">
                      <Pencil size={16} aria-hidden="true" />
                    </Link>
                    <DeleteTransactionButton id={t.id} description={t.description} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
