import type { MonthlySummary, CategoryMonthly } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { formatBRL } from "@/lib/utils/currency";
import { getLastNMonthsRange, getMonthLabel, formatDate } from "@/lib/utils/dates";

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { start, end } = getLastNMonthsRange(6);

  const { data: monthlySummary } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", user!.id)
    .gte("month", start)
    .lte("month", end)
    .order("month", { ascending: true }) as { data: MonthlySummary[] | null, error: unknown };

  const { data: categoryMonthly } = await supabase
    .from("category_monthly")
    .select("*")
    .eq("user_id", user!.id)
    .gte("month", start)
    .lte("month", end) as { data: CategoryMonthly[] | null, error: unknown };

  // Agrupar gastos por categoria (soma dos 6 meses)
  const categoryTotals = (categoryMonthly ?? []).reduce((acc, c) => {
    const key = c.category_id ?? "sem-cat";
    if (!acc[key]) acc[key] = { name: c.category_name, color: c.category_color, icon: c.category_icon, total: 0 };
    acc[key].total += c.total ?? 0;
    return acc;
  }, {} as Record<string, { name: string | null; color: string | null; icon: string | null; total: number }>);

  const sortedCategories = Object.values(categoryTotals).sort((a, b) => b.total - a.total);
  const maxCategoryTotal = sortedCategories[0]?.total ?? 1;

  // Totais gerais
  const grandIncome  = (monthlySummary ?? []).reduce((s, m) => s + (m.total_income ?? 0), 0);
  const grandExpense = (monthlySummary ?? []).reduce((s, m) => s + (m.total_expense ?? 0), 0);
  const savingsRate  = grandIncome > 0 ? ((grandIncome - grandExpense) / grandIncome) * 100 : 0;

  // Medias recorrentes (baseado em media simples das categorias)
  const { data: recurringTransactions } = await supabase
    .from("transactions")
    .select("amount, category:categories(name, icon)")
    .eq("user_id", user!.id)
    .eq("is_recurring", true)
    .gte("date", start)
    .lte("date", end);

  const recurringByCategory = (recurringTransactions ?? []).reduce((acc, t: any) => {
    const key = t.category?.name ?? "Sem categoria";
    if (!acc[key]) acc[key] = { icon: t.category?.icon ?? "📦", total: 0, count: 0 };
    acc[key].total += t.amount;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { icon: string; total: number; count: number }>);

  const maxBar = Math.max(...(monthlySummary ?? []).map(m => Math.max(m.total_income ?? 0, m.total_expense ?? 0)), 1);

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "32px 32px", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER ESPECÍFICO DE RELATÓRIOS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>
            {formatDate(new Date().toISOString())}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
            Relatórios
          </h1>
        </div>
      </div>

      <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 32 }} />

      {/* ACTIONS ROW */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, maxWidth: 1108 }}>
        {/* Period Selector */}
        <div style={{ background: "var(--color-surface-2)", border: "2px solid var(--color-primary)", boxShadow: "0px 0px 0px 3px rgba(110,86,232,0.3)", borderRadius: 8, height: 56, padding: "0 20px", display: "flex", alignItems: "center", gap: 10, color: "var(--color-text)", cursor: "pointer" }}>
          <svg viewBox="0 0 14 14" width="16" height="16" fill="currentColor" style={{ color: "var(--color-primary)" }}>
            <path d="M4.57666 0.60156q-0.12305 0.01367-0.24268 0.09912-0.11963 0.08203-0.1914 0.19483-0.04102 0.08545-0.05469 0.20508-0.01367 0.11621-0.01367 0.35546l0 0.29395-1.32959 0.01367q-0.14014 0.01367-0.23926 0.02735-0.50244 0.14014-0.85449 0.50586-0.34863 0.3623-0.44776 0.88183-0.02734 0.0957-0.02734 0.81006l0 7.99463 0.05469 0.15381q0.15723 0.51953 0.56055 0.86133 0.40674 0.3418 0.93994 0.3999 0.15381 0.02734 4.26904 0.02734 4.11523 0 4.26904-0.02734 0.30762-0.02734 0.58789-0.16748 0.32471-0.15381 0.56055-0.44092 0.23926-0.28711 0.35205-0.65283l0.05469-0.15381 0-7.99463q0-0.71436-0.02735-0.81006-0.09912-0.51953-0.45117-0.88183-0.34863-0.36572-0.85107-0.50586-0.09912-0.01367-0.23926-0.02735l-1.32959-0.01367 0-0.29395q0-0.32129-0.03418-0.45459-0.03418-0.1333-0.14697-0.24609-0.14014-0.14014-0.35889-0.16064-0.21533-0.02051-0.37597 0.09228-0.16064 0.10938-0.21875 0.29395-0.02734 0.05469-0.03418 0.1333-0.00684 0.0752-0.00684 0.30078l0 0.33496-3.5 0 0-0.34863q0-0.23926-0.00684-0.30762-0.00684-0.07178-0.03418-0.12646-0.08545-0.21191-0.25293-0.30762-0.16748-0.09912-0.37939-0.05811z m-0.50244 2.67285q0.01367 0.25293 0.02051 0.31788 0.00684 0.06152 0.03418 0.14697 0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445 0.02734-0.08545 0.03418-0.14014 0.00684-0.05811 0.02051-0.32129l0-0.36572 3.5 0 0 0.36572q0.01367 0.26318 0.02051 0.32129 0.00684 0.05469 0.03418 0.14014 0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115 0.02734-0.08545 0.03418-0.14697 0.00684-0.06494 0.02051-0.31788l0-0.34863 1.31592 0 0.08545 0.04102q0.08203 0.04443 0.15722 0.12304 0.07861 0.0752 0.11963 0.16065 0.04443 0.08203 0.05811 0.28027 0.01367 0.19482 0.01367 0.85108l0 0.86816-9.35156 0 0.01367-1.72266q0.01367-0.16748 0.02734-0.20849 0.09912-0.2666 0.35206-0.36572 0.05469-0.01367 0.16748-0.02735l1.18945 0 0 0.34863z m7.58789 5.82422q0 1.89014-0.00684 2.30371-0.00683 0.41357-0.0205 0.45459-0.09912 0.25293-0.35206 0.35205l-0.0957 0.04102-8.37402 0-0.0957-0.04102q-0.15381-0.0581-0.26661-0.19824l-0.02734-0.02734q-0.04443-0.05469-0.05811-0.15381-0.02734-0.14014-0.02734-0.60156l-0.01367-4.80225 9.35156 0-0.01367 2.67285z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{getMonthLabel(end)} {new Date(end).getFullYear()} – Últimos 6 meses</span>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor" style={{ color: "var(--color-text-2)" }}>
            <path d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z" />
          </svg>
        </div>

        {/* Export PDF Button */}
        <button style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-primary)", borderRadius: 3, height: 56, padding: "0 20px", display: "flex", alignItems: "center", gap: 10, color: "var(--color-text)", cursor: "pointer", boxShadow: "0px 0px 0px 3px rgba(110,86,232,0.2)" }}>
          <svg viewBox="0 0 14 14" width="16" height="16" fill="currentColor" style={{ color: "var(--color-primary)" }}>
            <path d="M3.33252 0.60156q-0.58789 0.04102-1.02197 0.44776-0.43408 0.40674-0.53321 0.99463-0.02734 0.16748-0.02734 4.95605 0 4.78857 0.02734 4.95605 0.09912 0.5332 0.46827 0.92627 0.37256 0.38965 0.90576 0.50245 0.10938 0.01367 0.66992 0.02734l3.17871 0 3.17871 0q0.56055-0.01367 0.66992-0.02734 0.5332-0.11279 0.90235-0.50245 0.37256-0.39307 0.47168-0.92627 0.02734-0.16748 0.02734-3.80078 0-3.6333-0.02734-3.80078-0.08545-0.51953-0.40674-0.92285-0.11279-0.14014-1.24756-1.2749-0.89551-0.88184-1.10742-1.06983-0.2085-0.19141-0.41699-0.29052-0.30762-0.15381-0.67334-0.19483-0.14014-0.02734-2.4917-0.02734-2.35156 0-2.54639 0.02734z m4.25537 2.42334l0 1.27149 0.04102 0.14013q0.08545 0.22559 0.24609 0.40674 0.16064 0.18115 0.35547 0.28028 0.14014 0.07178 0.22558 0.08544 0.12646 0.02734 0.40674 0.04102l2.21143 0 0 6.11816q0 0.43408-0.0376 0.51954-0.03418 0.08203-0.11963 0.17431-0.08203 0.08887-0.16406 0.1333l-0.09912 0.04102-7.30762 0-0.09912-0.04102q-0.08203-0.04443-0.16748-0.1333-0.08203-0.09228-0.11963-0.17431-0.03418-0.08545-0.03418-0.70069l0-4.18701 0-4.18701q0-0.61523 0.02734-0.6836 0.05811-0.12646 0.16749-0.23242 0.11279-0.10596 0.23925-0.1333 0.08545-0.01367 2.14307-0.01367l2.07129 0 0.01367 1.2749z m2.21143 0.01367l1.03564 1.03565-2.08496 0 0-1.03565q0-1.03564 0-1.04931l1.04932 1.04931z m-2.95313 3.40088q-0.25293 0.08545-0.37939 0.30762l-0.04102 0.08545 0 2.25244-0.40674-0.40332q-0.2666-0.2666-0.3623-0.33838-0.12646-0.11279-0.19824-0.14013-0.06836-0.02734-0.19483-0.02735-0.12646 0-0.16748 0.01367-0.04102 0.01367-0.09912 0.04102-0.18115 0.09912-0.28027 0.2666-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04102 0.25293 0.04443 0.08203 0.98779 1.02881 0.94678 0.94336 1.02881 1.00146 0.05811 0.02734 0.10596 0.03418 0.04785 0.00684 0.16064 0.00684 0.11279 0 0.16064-0.00684 0.04785-0.00684 0.10596-0.03418 0.08203-0.05811 1.02539-1.00146 0.94678-0.94678 0.9878-1.02881 0.04443-0.08545 0.04443-0.25293 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.16748-0.01367-0.12646 0-0.19824 0.02735-0.06836 0.02734-0.19483 0.14013-0.0957 0.07178-0.3623 0.33838l-0.40674 0.40332 0-2.25244-0.04102-0.08545q-0.09912-0.18115-0.28027-0.2666-0.08545-0.04102-0.22559-0.04785-0.14014-0.00684-0.18115 0.00683z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Exportar PDF</span>
        </button>
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        
        {/* Entradas x Saídas */}
        <div style={{ flex: "0 0 660px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, height: 420, padding: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Entradas x Saídas</div>
              <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 6 }}>Comparativo dos últimos 6 meses</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, background: "var(--color-success)" }} />
                <span style={{ fontSize: 12, color: "var(--color-text)" }}>Entradas</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, background: "var(--color-danger)" }} />
                <span style={{ fontSize: 12, color: "var(--color-text)" }}>Saídas</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", paddingBottom: 32, paddingLeft: 40, paddingRight: 40 }}>
            {/* Baseline */}
            <div style={{ position: "absolute", bottom: 31, left: 0, right: 0, height: 1, background: "var(--color-border)" }} />
            
            {(monthlySummary ?? []).map(m => {
              // Ajuste de altura máximo 240px para caber na div
              const incH = Math.max(((m.total_income ?? 0) / maxBar) * 240, 4);
              const expH = Math.max(((m.total_expense ?? 0) / maxBar) * 240, 4);
              return (
                <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ width: 22, height: incH, background: "var(--color-success)" }} title={`Receita: ${formatBRL(m.total_income ?? 0)}`} />
                    <div style={{ width: 22, height: expH, background: "var(--color-danger)" }} title={`Despesa: ${formatBRL(m.total_expense ?? 0)}`} />
                  </div>
                  <div style={{ position: "absolute", bottom: 0, fontSize: 12, color: "var(--color-text-2)", textTransform: "lowercase" }}>
                    {m.month ? getMonthLabel(m.month).substring(0, 3) : ""}
                  </div>
                </div>
              );
            })}
            {(monthlySummary?.length === 0) && (
               <div style={{ position: "absolute", bottom: 40, width: "100%", textAlign: "center", color: "var(--color-text-3)", fontSize: 13 }}>Sem dados para exibir</div>
            )}
          </div>
        </div>

        {/* Gastos por categoria */}
        <div style={{ flex: "1 1 auto", maxWidth: 424, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, height: 420, padding: 24, display: "flex", flexDirection: "column" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Gastos por categoria</div>
            <div style={{ fontSize: 12, color: "var(--color-text-2)", marginTop: 6, marginBottom: 24 }}>Total do período: {formatBRL(grandExpense)}</div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", paddingRight: 4 }}>
            {sortedCategories.slice(0, 6).map((c, i) => {
              const pct = grandExpense > 0 ? (c.total / grandExpense) * 100 : 0;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{formatBRL(c.total)}</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--color-border)", borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: 6, background: "var(--color-primary)", borderRadius: 2, boxShadow: "0px 0px 12px 0px rgba(110, 86, 232, 0.33)", marginTop: 1 }} />
                  </div>
                </div>
              );
            })}
            {sortedCategories.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-3)", textAlign: "center", padding: "20px 0" }}>Nenhum gasto no período.</div>
            )}
          </div>
        </div>
      </div>

      {/* MÉDIA DE GASTOS RECORRENTES E HISTÓRICO (Preservados e adaptados) */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, maxWidth: 1108 }}>
        
        {/* Histórico mensal (Tabela) */}
        <div style={{ flex: "2", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", marginBottom: 20 }}>Histórico Mensal</div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr 1fr", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--color-text)", fontSize: 11, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 8 }}>
            <div>MÊS</div>
            <div>RECEITAS</div>
            <div>DESPESAS</div>
            <div>SALDO</div>
            <div>TX POUPANÇA</div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(monthlySummary ?? []).slice().reverse().map((m, i) => {
              const net = m.net ?? 0;
              const rate = (m.total_income ?? 0) > 0 ? (net / (m.total_income ?? 1)) * 100 : 0;
              return (
                <div key={m.month || i} className="transaction-row" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr 1fr", gap: 16, alignItems: "center", padding: "16px 12px", margin: "0 -12px", borderBottom: "1px solid var(--color-border)", borderRadius: 6, transition: "background 0.15s" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize", color: "var(--color-text)" }}>
                    {m.month ? new Date(m.month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-success)" }}>
                    {formatBRL(m.total_income ?? 0)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-danger)" }}>
                    {formatBRL(m.total_expense ?? 0)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: net >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                    {formatBRL(net)}
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 8px", borderRadius: 4, background: rate >= 30 ? "rgba(34,197,94,0.15)" : rate >= 10 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)", color: rate >= 30 ? "var(--color-success)" : rate >= 10 ? "var(--color-warning)" : "var(--color-danger)" }}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Média Recorrente */}
        <div style={{ flex: "1", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", marginBottom: 6 }}>Recorrência</div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)", marginBottom: 24 }}>Média mensal de gastos</div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(recurringByCategory).map(([name, data]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {data.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>{data.count} lançamentos</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                  {formatBRL(data.total / 6)}
                </div>
              </div>
            ))}
            {Object.keys(recurringByCategory).length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-3)", textAlign: "center", padding: "20px 0" }}>Nenhuma despesa recorrente.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

