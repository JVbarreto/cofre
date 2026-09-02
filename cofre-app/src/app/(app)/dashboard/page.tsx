import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { formatBRL } from "@/lib/utils/currency";
import { getCurrentMonthRange, formatMonth } from "@/lib/utils/dates";
import type { TransactionWithCategory, Investment, CategoryMonthly } from "@/types/database";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { start, end } = getCurrentMonthRange();

  // Busca transacoes do mes
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("user_id", user!.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false }) as unknown as { data: TransactionWithCategory[] | null };

  // Busca investimentos
  const { data: investments } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_active", true) as unknown as { data: Investment[] | null };

  // Busca resumo dos ultimos 6 meses
  const { data: monthlySummary } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", user!.id)
    .order("month", { ascending: true });

  // Busca metas por categoria no mes
  const { data: categoryMonthly } = await supabase
    .from("category_monthly")
    .select("*")
    .eq("user_id", user!.id)
    .gte("month", start)
    .lte("month", end) as unknown as { data: CategoryMonthly[] | null };

  const totalIncome  = transactions?.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpense = transactions?.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;
  const netBalance   = totalIncome - totalExpense;
  const totalInvested = investments?.reduce((s, i) => s + (i.current_value ?? i.initial_value), 0) ?? 0;

  const recentTransactions = transactions?.slice(0, 5) ?? [];

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "32px 32px", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER ESPECÍFICO DO PAINEL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>
            {formatMonth(new Date())}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
            Painel
          </h1>
        </div>
        <Link href="/lancamentos/novo" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "var(--color-primary)", color: "var(--color-text)",
          padding: "0 20px", height: 46, borderRadius: 8,
          fontSize: 14, fontWeight: 600, textDecoration: "none",
          boxShadow: "0px 4px 24px 0px rgba(110, 86, 232, 0.33)",
          outline: "1px solid var(--color-primary)", outlineOffset: "-0.5px"
        }}>
          + Novo lançamento
        </Link>
      </div>

      <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 32 }} />

      {/* KPI CARDS (Summary Cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        
        {/* Saldo de hoje */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 18, height: 126, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>Saldo do mês</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", margin: "8px 0" }}>{formatBRL(netBalance)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>Balanço das contas</div>
        </div>
        
        {/* Entradas do mês */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 18, height: 126, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>Entradas do mês</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "var(--color-success)", letterSpacing: "-0.5px", margin: "8px 0" }}>{formatBRL(totalIncome)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>100% do previsto</div>
        </div>
        
        {/* Saídas do mês */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 18, height: 126, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>Saídas do mês</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "var(--color-danger)", letterSpacing: "-0.5px", margin: "8px 0" }}>{formatBRL(totalExpense)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>Gastos registrados</div>
        </div>
        
        {/* Investido no mês */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 18, height: 126, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>Investimentos (Total)</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "var(--color-primary)", letterSpacing: "-0.5px", margin: "8px 0" }}>{formatBRL(totalInvested)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>Saldo alocado</div>
        </div>
        
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 32 }}>

        {/* Últimos lançamentos (Transactions Card) */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Últimos lançamentos</div>
          <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 4, marginBottom: 24 }}>Movimentações recentes</div>
          
          <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 12 }} />
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr 2fr 2fr", gap: 16, padding: "8px 0", fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>
            <div>Data</div>
            <div>Descrição</div>
            <div>Categoria</div>
            <div style={{ textAlign: "right" }}>Valor</div>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-3)", fontSize: 14 }}>Nenhum lançamento este mês</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentTransactions.map((t: any) => (
                <div key={t.id}>
                  <div style={{ width: "100%", height: 1, background: "var(--color-border)", margin: "8px 0" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr 2fr 2fr", gap: 16, alignItems: "center", padding: "8px 0" }}>
                    <div style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                      {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                      {t.description}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                      {t.category?.name ?? "Sem categoria"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: "right", color: t.type === "income" ? "var(--color-success)" : "var(--color-danger)" }}>
                      {t.type === "income" ? "" : "-"}{formatBRL(t.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metas por categoria (substituindo Recurring Card) */}
        <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 25, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Metas do mês</div>
          <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 4, marginBottom: 24 }}>Progresso de gastos por categoria</div>
          
          {!categoryMonthly || categoryMonthly.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-3)", fontSize: 14 }}>Nenhum gasto registrado</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {categoryMonthly.filter(c => c.category_budget).slice(0, 5).map((c: any) => {
                const pct = Math.min((c.total / c.category_budget) * 100, 100);
                const over = c.total > c.category_budget;
                return (
                  <div key={c.category_id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{c.category_name}</span>
                      <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                        {formatBRL(c.total)} / {formatBRL(c.category_budget)}
                      </span>
                    </div>
                    <div style={{ height: 12, background: "var(--color-bg)", borderRadius: 2, outline: "1px solid var(--color-border)", outlineOffset: "-0.5px", position: "relative" }}>
                      <div style={{ width: `${pct}%`, height: 10, background: over ? "var(--color-danger)" : "var(--color-primary)", borderRadius: 1, position: "absolute", left: 1, top: 1, boxShadow: over ? "none" : "0px 0px 12px 0px rgba(110,86,232,0.33)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
