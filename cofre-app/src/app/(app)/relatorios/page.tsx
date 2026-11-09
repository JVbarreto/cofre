import type { MonthlySummary, CategoryMonthly, Database } from "@/types/database";
import { mapResumoMensal, mapGastoCategoria } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import { getLastNMonthsRange, formatMonth } from "@/lib/utils/dates";
import { Calendar } from "lucide-react";

const CAT_COLORS = ["var(--color-danger)", "var(--color-warning)", "var(--color-primary)", "#a855f7", "var(--color-text-2)"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const brlInt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { start, end } = getLastNMonthsRange(6);

  const { data: resumoRaw } = await supabase
    .from("resumo_mensal")
    .select("*")
    .eq("user_id", user!.id)
    .gte("mes", start)
    .lte("mes", end)
    .order("mes", { ascending: true }) as unknown as { data: Database["public"]["Views"]["resumo_mensal"]["Row"][] | null };
  const monthlySummary: MonthlySummary[] = resumoRaw?.map(mapResumoMensal) ?? [];

  const { data: gastosRaw } = await supabase
    .from("gastos_categoria_mensal")
    .select("*")
    .eq("user_id", user!.id)
    .gte("mes", start)
    .lte("mes", end) as unknown as { data: Database["public"]["Views"]["gastos_categoria_mensal"]["Row"][] | null };
  const categoryMonthly: CategoryMonthly[] = gastosRaw?.map(mapGastoCategoria) ?? [];

  // Agrupar gastos por categoria (soma do período) e preservar orçamento se configurado
  const categoryTotals = categoryMonthly.reduce((acc, c) => {
    const key = c.category_id ?? c.category_name ?? "sem-cat";
    if (!acc[key]) {
      acc[key] = { name: c.category_name ?? "Sem categoria", total: 0, budget: c.category_budget ?? null };
    }
    acc[key].total += c.total ?? 0;
    if (c.category_budget && !acc[key].budget) acc[key].budget = c.category_budget;
    return acc;
  }, {} as Record<string, { name: string; total: number; budget: number | null }>);

  const sortedCategories = Object.values(categoryTotals)
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Metas / orçamentos por categoria (mês mais recente ou acumulado com budget)
  const latestMonth = monthlySummary[monthlySummary.length - 1]?.month?.slice(0, 7);
  const currentMonthCategories = latestMonth
    ? categoryMonthly.filter(c => c.month?.slice(0, 7) === latestMonth && c.category_budget)
    : categoryMonthly.filter(c => c.category_budget);

  // Totais gerais do período
  const grandIncome  = monthlySummary.reduce((s, m) => s + (m.total_income ?? 0), 0);
  const grandExpense = monthlySummary.reduce((s, m) => s + (m.total_expense ?? 0), 0);
  const grandSaved   = grandIncome - grandExpense;
  const savingsRate  = grandIncome > 0 ? (grandSaved / grandIncome) * 100 : 0;

  // Mês atual (para exibição mobile / resumo)
  const currentSummary = monthlySummary[monthlySummary.length - 1];
  const monthIncome  = currentSummary?.total_income ?? grandIncome;
  const monthExpense = currentSummary?.total_expense ?? grandExpense;
  const monthSaved   = monthIncome - monthExpense;
  const monthRate    = monthIncome > 0 ? (monthSaved / monthIncome) * 100 : savingsRate;

  const monthLabel = cap(formatMonth(new Date()));
  const yearNumber = new Date().getFullYear();

  return (
    <div className="page">
      <header className="page-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="h1">
            <span className="only-d">Relatórios &amp; Análises</span>
            <span className="only-m">Relatórios</span>
          </h1>
          <p className="page-sub only-d">Distribuição por categorias, evolução patrimonial e metas</p>
        </div>
        <div className="head-actions">
          <span className="pill">
            <Calendar size={15} className="only-d" aria-hidden="true" />
            <span className="only-d">Ano {yearNumber} (Últimos 6 meses)</span>
            <span className="only-m">{monthLabel}</span>
          </span>
        </div>
      </header>

      {monthlySummary.length === 0 && sortedCategories.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Ainda não há dados para os relatórios</div>
          <p>Os relatórios usam os lançamentos dos últimos seis meses. Registre entradas e saídas para ver a comparação mensal e os gastos por categoria.</p>
        </div>
      ) : (
        <>
          {/* ================= DESKTOP ================= */}
          <div className="dash-desktop" style={{ display: "contents" }}>
            <div className="report-grid">
              {/* Card Esquerdo: Distribuição de Despesas por Categoria */}
              <section className="card" aria-labelledby="cat-dist-titulo">
                <div className="section-head" style={{ alignItems: "center" }}>
                  <h2 id="cat-dist-titulo" className="card-title">Distribuição de Despesas por Categoria</h2>
                  <span className="num" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)", color: "var(--color-danger)" }}>
                    Total: {formatBRL(grandExpense)}
                  </span>
                </div>

                {sortedCategories.length === 0 ? (
                  <p className="muted">Nenhuma saída registrada no período.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
                    {sortedCategories.slice(0, 6).map((c, idx) => {
                      const pct = grandExpense > 0 ? (c.total / grandExpense) * 100 : 0;
                      const color = CAT_COLORS[Math.min(idx, CAT_COLORS.length - 1)];
                      return (
                        <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-3)" }}>
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>{c.name}</span>
                            <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>
                              {formatBRL(c.total)} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div
                            className="meter"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pct)}
                            aria-label={`${c.name}: ${pct.toFixed(1)}% das despesas`}
                          >
                            <span style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Card Direito: Taxa de Poupança + Metas */}
              <section className="card" aria-labelledby="poupanca-titulo">
                <h2 id="poupanca-titulo" className="card-title">Taxa de Poupança Mensal</h2>

                <div className="savings-box">
                  <div
                    className="num savings-rate"
                    style={{ color: savingsRate >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                  >
                    {savingsRate.toFixed(1).replace(".", ",")}%
                  </div>
                  <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 4 }}>
                    {grandSaved >= 0
                      ? `Você economizou ${formatBRL(grandSaved)} das receitas totais de ${formatBRL(grandIncome)}.`
                      : `Suas despesas superaram as receitas em ${formatBRL(Math.abs(grandSaved))} no período.`}
                  </p>
                </div>

                <div className="field-label" style={{ marginTop: "var(--sp-2)" }}>
                  Metas do ano {yearNumber}
                </div>

                {currentMonthCategories.length === 0 ? (
                  <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    Defina limites de orçamento nas suas categorias para acompanhar o progresso aqui.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
                    {currentMonthCategories.slice(0, 4).map(c => {
                      const total = c.total ?? 0;
                      const budget = c.category_budget ?? 1;
                      const pct = Math.min((total / budget) * 100, 100);
                      const over = total > budget;
                      return (
                        <div key={c.category_id ?? c.category_name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-3)" }}>
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>{c.category_name}</span>
                            <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>
                              {formatBRL(total)} / {formatBRL(budget)}
                            </span>
                          </div>
                          <div className={`meter ${over ? "over" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* ================= MOBILE ================= */}
          <div className="dash-mobile">
            <section className="m-card" aria-label="Taxa de poupança no mês">
              <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>
                Taxa de Poupança no Mês
              </span>
              <div
                className="num savings-rate"
                style={{ color: monthRate >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
              >
                {monthRate.toFixed(1).replace(".", ",")}%
              </div>
              <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                {monthSaved >= 0
                  ? `Economia de ${formatBRL(monthSaved)} no período`
                  : `Déficit de ${formatBRL(Math.abs(monthSaved))} no período`}
              </p>
            </section>

            <section className="m-card" aria-label="Despesas por categoria">
              <h2 className="card-title">Despesas por Categoria</h2>
              {sortedCategories.length === 0 ? (
                <p className="muted" style={{ fontSize: "var(--text-xs)" }}>Nenhuma saída registrada.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                  {sortedCategories.slice(0, 5).map((c, idx) => {
                    const pct = grandExpense > 0 ? (c.total / grandExpense) * 100 : 0;
                    const color = CAT_COLORS[Math.min(idx, CAT_COLORS.length - 1)];
                    return (
                      <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-2)" }}>
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>{c.name}</span>
                          <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>
                            {brlInt(c.total)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="meter">
                          <span style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {currentMonthCategories.length > 0 && (
              <section className="m-card" aria-label="Metas">
                <h2 className="card-title">Metas de {yearNumber}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                  {currentMonthCategories.slice(0, 4).map(c => {
                    const total = c.total ?? 0;
                    const budget = c.category_budget ?? 1;
                    const pct = Math.min((total / budget) * 100, 100);
                    return (
                      <div key={c.category_id ?? c.category_name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-2)" }}>
                          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{c.category_name}</span>
                          <span className="num" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)", color: "var(--color-primary)" }}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="meter">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
