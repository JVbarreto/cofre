import type { MonthlySummary, CategoryMonthly, Database } from "@/types/database";
import { mapResumoMensal, mapGastoCategoria } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import { getLastNMonthsRange, getMonthLabel } from "@/lib/utils/dates";

// "2026-10-01" vira meio-dia local, para o mês não recuar um dia por causa do fuso horário
const atNoon = (iso: string) => `${iso.slice(0, 10)}T12:00:00`;

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

  // Agrupar gastos por categoria (soma dos 6 meses)
  const categoryTotals = categoryMonthly.reduce((acc, c) => {
    const key = c.category_id ?? "sem-cat";
    if (!acc[key]) acc[key] = { name: c.category_name, total: 0 };
    acc[key].total += c.total ?? 0;
    return acc;
  }, {} as Record<string, { name: string | null; total: number }>);

  const sortedCategories = Object.values(categoryTotals).sort((a, b) => b.total - a.total);

  // Totais gerais
  const grandIncome  = monthlySummary.reduce((s, m) => s + (m.total_income ?? 0), 0);
  const grandExpense = monthlySummary.reduce((s, m) => s + (m.total_expense ?? 0), 0);
  const savingsRate  = grandIncome > 0 ? ((grandIncome - grandExpense) / grandIncome) * 100 : 0;

  // Medias recorrentes (baseado em media simples das categorias)
  const { data: recurringTransactions } = await supabase
    .from("transacoes")
    .select("valor, category:categorias(nome)")
    .eq("user_id", user!.id)
    .eq("tipo", "saida")
    .eq("recorrente", true)
    .gte("data", start)
    .lte("data", end);

  const recurringByCategory = (recurringTransactions ?? []).reduce((acc, t: any) => {
    const key = t.category?.nome ?? "Sem categoria";
    if (!acc[key]) acc[key] = { total: 0, count: 0 };
    acc[key].total += Number(t.valor);
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const maxBar = Math.max(...monthlySummary.map(m => Math.max(m.total_income ?? 0, m.total_expense ?? 0)), 1);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Últimos 6 meses</div>
          <h1 className="h1">Relatórios</h1>
        </div>
      </header>

      {monthlySummary.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Ainda não há dados para os relatórios</div>
          <p>Os relatórios usam os lançamentos dos últimos seis meses. Registre entradas e saídas para ver a comparação mensal e os gastos por categoria.</p>
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="resumo-titulo">
            <h2 id="resumo-titulo" className="eyebrow">Resumo do período</h2>
            <dl className="ledger" style={{ maxWidth: 520 }}>
              <div className="ledger-row"><dt>Entradas</dt><dd className="num amount-in">{formatBRL(grandIncome)}</dd></div>
              <div className="ledger-row"><dt>Saídas</dt><dd className="num amount-out">{formatBRL(grandExpense)}</dd></div>
              <div className="ledger-row"><dt>Taxa de poupança</dt><dd className="num">{savingsRate.toFixed(1)}%</dd></div>
            </dl>
          </section>

          <section className="section" aria-labelledby="comparativo-titulo">
            <div className="section-head">
              <h2 id="comparativo-titulo" className="h2">Entradas e saídas por mês</h2>
              <div className="legend" aria-hidden="true">
                <span><i className="bar-in" />Entradas</span>
                <span><i className="bar-out" />Saídas</span>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div className="bars" style={{ minWidth: 320 }} role="img" aria-label="Gráfico de barras de entradas e saídas por mês">
                {monthlySummary.map(m => {
                  const incH = ((m.total_income ?? 0) / maxBar) * 100;
                  const expH = ((m.total_expense ?? 0) / maxBar) * 100;
                  return (
                    <div key={m.month} className="bar-group">
                      <div className="bar-pair">
                        <span className="bar-in"  style={{ height: `${incH}%` }} title={`Entradas: ${formatBRL(m.total_income ?? 0)}`} />
                        <span className="bar-out" style={{ height: `${expH}%` }} title={`Saídas: ${formatBRL(m.total_expense ?? 0)}`} />
                      </div>
                      <div className="bar-label">{m.month ? getMonthLabel(atNoon(m.month)).replace(".", "") : ""}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="dash-grid">
            <section className="section" aria-labelledby="categorias-titulo">
              <h2 id="categorias-titulo" className="h2">Gastos por categoria</h2>
              {sortedCategories.length === 0 ? (
                <p className="muted">Nenhuma saída registrada no período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
                  {sortedCategories.slice(0, 6).map(c => {
                    const pct = grandExpense > 0 ? (c.total / grandExpense) * 100 : 0;
                    return (
                      <div key={c.name ?? "sem-categoria"} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-3)" }}>
                          <span style={{ fontWeight: "var(--weight-medium)" }}>{c.name}</span>
                          <span className="num">{formatBRL(c.total)}</span>
                        </div>
                        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`${c.name}: ${Math.round(pct)}% das saídas`}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section" aria-labelledby="recorrencia-titulo">
              <h2 id="recorrencia-titulo" className="h2">Saídas recorrentes</h2>
              {Object.keys(recurringByCategory).length === 0 ? (
                <p className="muted">Nenhuma saída marcada como recorrente no período.</p>
              ) : (
                <dl className="ledger">
                  {Object.entries(recurringByCategory).map(([name, data]) => (
                    <div key={name} className="ledger-row">
                      <dt>{name} <span className="hint">({data.count} {data.count === 1 ? "lançamento" : "lançamentos"})</span></dt>
                      <dd className="num">{formatBRL(data.total / 6)}<span className="muted">/mês</span></dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>

          <section className="section" aria-labelledby="historico-titulo">
            <h2 id="historico-titulo" className="h2">Histórico mensal</h2>
            <div className="table-responsive">
              <div className="table cols-month" style={{ minWidth: 540 }}>
                <div className="table-head">
                  <div>Mês</div><div className="num">Entradas</div><div className="num">Saídas</div><div className="num">Saldo</div><div className="num">Poupança</div>
                </div>
                {monthlySummary.slice().reverse().map((m, i) => {
                  const net = m.net ?? 0;
                  const rate = (m.total_income ?? 0) > 0 ? (net / (m.total_income ?? 1)) * 100 : 0;
                  return (
                    <div key={m.month || i} className="table-row">
                      <div className="strong" style={{ textTransform: "capitalize" }}>
                        {m.month ? new Date(atNoon(m.month)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—"}
                      </div>
                      <div className="num amount-in">{formatBRL(m.total_income ?? 0)}</div>
                      <div className="num amount-out">{formatBRL(m.total_expense ?? 0)}</div>
                      <div className={`num strong ${net >= 0 ? "amount-in" : "amount-out"}`}>{formatBRL(net)}</div>
                      <div className="num">
                        <span className={`badge ${rate >= 30 ? "badge-success" : rate >= 10 ? "badge-warning" : "badge-danger"}`}>{rate.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
