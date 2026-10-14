import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import { getCurrentMonthRange, formatMonth } from "@/lib/utils/dates";
import type { TransactionWithCategory, Investment, CategoryMonthly, TransacaoRow, CategoriaRow, InvestimentoRow, Database } from "@/types/database";
import { mapTransacaoComCategoria, mapInvestimento, mapGastoCategoria } from "@/lib/data/mappers";
import Link from "next/link";
import { Plus } from "lucide-react";

// "2026-10-05" -> "05/10", sem passar por Date (evita deslocar o dia por fuso horário)
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { start, end } = getCurrentMonthRange();

  // Busca transacoes do mes
  const { data: transacoesRaw } = await supabase
    .from("transacoes")
    .select("*, categoria:categorias(*)")
    .eq("user_id", user!.id)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false }) as unknown as { data: (TransacaoRow & { categoria: CategoriaRow | null })[] | null };
  const transactions: TransactionWithCategory[] | null = transacoesRaw?.map(mapTransacaoComCategoria) ?? null;

  // Busca investimentos
  const { data: investimentosRaw } = await supabase
    .from("investimentos")
    .select("*")
    .eq("user_id", user!.id) as unknown as { data: InvestimentoRow[] | null };
  const investments: Investment[] | null = investimentosRaw?.map(mapInvestimento) ?? null;

  // Busca metas por categoria no mes
  const { data: gastosRaw } = await supabase
    .from("gastos_categoria_mensal")
    .select("*")
    .eq("user_id", user!.id)
    .gte("mes", start)
    .lte("mes", end) as unknown as { data: Database["public"]["Views"]["gastos_categoria_mensal"]["Row"][] | null };
  const categoryMonthly: CategoryMonthly[] | null = gastosRaw?.map(mapGastoCategoria) ?? null;

  const totalIncome  = transactions?.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpense = transactions?.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;
  const netBalance   = totalIncome - totalExpense;
  const totalInvested = investments?.reduce((s, i) => s + (i.current_value ?? i.initial_value), 0) ?? 0;

  const recentTransactions = transactions?.slice(0, 5) ?? [];
  const budgets = (categoryMonthly ?? []).filter(c => c.category_budget).slice(0, 5);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{formatMonth(new Date())}</div>
          <h1 className="h1">Painel</h1>
        </div>
        <Link href="/lancamentos/novo" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Novo lançamento
        </Link>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: "var(--sp-12)" }} className="dash-grid">

        {/* Saldo do mês: o número principal, com as contas que o compõem */}
        <section className="section" aria-labelledby="saldo-titulo">
          <h2 id="saldo-titulo" className="eyebrow">Saldo do mês</h2>
          <div
            className="num"
            style={{
              fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-strong)",
              letterSpacing: "var(--tracking-tight)", lineHeight: "var(--leading-title)", textAlign: "left",
              color: netBalance < 0 ? "var(--color-danger)" : "var(--color-text)",
            }}
          >
            {formatBRL(netBalance)}
          </div>
          <dl className="ledger" style={{ marginTop: "var(--sp-4)" }}>
            <div className="ledger-row"><dt>Entradas</dt><dd className="num amount-in">{formatBRL(totalIncome)}</dd></div>
            <div className="ledger-row"><dt>Saídas</dt><dd className="num amount-out">{formatBRL(totalExpense)}</dd></div>
            <div className="ledger-row"><dt>Total investido</dt><dd className="num">{formatBRL(totalInvested)}</dd></div>
          </dl>
        </section>

        {/* Orçamento por categoria */}
        <section className="section" aria-labelledby="metas-titulo">
          <h2 id="metas-titulo" className="eyebrow">Gastos x orçamento</h2>
          {budgets.length === 0 ? (
            <p className="muted">Nenhuma categoria com orçamento teve gasto neste mês.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
              {budgets.map(c => {
                const total = c.total ?? 0;
                const budget = c.category_budget ?? 0;
                const pct = Math.min((total / budget) * 100, 100);
                const over = total > budget;
                return (
                  <div key={c.category_id ?? c.category_name} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-3)" }}>
                      <span style={{ fontWeight: "var(--weight-medium)" }}>{c.category_name}</span>
                      <span className="muted num">{formatBRL(total)} de {formatBRL(budget)}</span>
                    </div>
                    <div
                      className={`meter ${over ? "over" : ""}`}
                      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
                      aria-label={`${c.category_name}: ${Math.round((total / budget) * 100)}% do orçamento`}
                    >
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Últimos lançamentos */}
      <section className="section" aria-labelledby="ultimos-titulo">
        <div className="section-head">
          <h2 id="ultimos-titulo" className="h2">Últimos lançamentos</h2>
          <Link href="/lancamentos" className="link" style={{ fontSize: "var(--text-sm)" }}>Ver todos</Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nada lançado neste mês</div>
            <p>Registre a primeira entrada ou saída para ver o saldo e os gastos por categoria.</p>
            <Link href="/lancamentos/novo" className="btn btn-ghost">Novo lançamento</Link>
          </div>
        ) : (
          <div className="table cols-dash">
            <div className="table-head">
              <div>Data</div><div>Descrição</div><div>Categoria</div><div className="num">Valor</div>
            </div>
            {recentTransactions.map(t => (
              <div key={t.id} className="table-row">
                <div className="muted num" style={{ textAlign: "left" }}>{dayMonth(t.date)}</div>
                <div className="strong">{t.description}</div>
                <div className="muted">{t.category?.name ?? "Sem categoria"}</div>
                <div className={`num ${t.type === "income" ? "amount-in" : "amount-out"}`}>
                  {t.type === "income" ? "" : "− "}{formatBRL(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
