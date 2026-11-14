import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import { getCurrentMonthRange, getLastNMonthsRange, formatMonth } from "@/lib/utils/dates";
import type { TransactionWithCategory, Investment, CategoryMonthly, TransacaoRow, CategoriaRow, InvestimentoRow, Database } from "@/types/database";
import { mapTransacaoComCategoria, mapInvestimento, mapGastoCategoria } from "@/lib/data/mappers";
import Link from "next/link";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CalendarClock, ArrowRight, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, Calendar } from "lucide-react";

// "2026-10-05" -> "05/10/2026", sem passar por Date (evita deslocar o dia por fuso horário)
const fullDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const brlInt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const dayDiff = (aIso: string, bIso: string) => {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
};

type FlowRow = { tipo: string; valor: number | string; data: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { start, end } = getCurrentMonthRange();
  const flowRange = getLastNMonthsRange(6);

  // Busca transacoes do mes
  const { data: transacoesRaw } = await supabase
    .from("transacoes")
    .select("*, categoria:categorias(*)")
    .eq("user_id", user!.id)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false }) as unknown as { data: (TransacaoRow & { categoria: CategoriaRow | null })[] | null };
  const transactions: TransactionWithCategory[] | null = transacoesRaw?.map(mapTransacaoComCategoria) ?? null;

  // Fluxo de caixa dos últimos 6 meses (para o gráfico)
  const { data: flowRaw } = await (supabase as any)
    .from("transacoes")
    .select("tipo, valor, data")
    .eq("user_id", user!.id)
    .gte("data", flowRange.start)
    .lte("data", flowRange.end)
    .range(0, 9999) as { data: FlowRow[] | null };

  // Saldo acumulado (todas as entradas menos todas as saídas)
  const { data: allRaw } = await (supabase as any)
    .from("transacoes")
    .select("tipo, valor")
    .eq("user_id", user!.id)
    .range(0, 9999) as { data: Pick<FlowRow, "tipo" | "valor">[] | null };

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

  // Busca contas a pagar
  const { data: contasRaw } = await (supabase as any)
    .from("contas_pagar")
    .select("*")
    .eq("user_id", user!.id)
    .order("prazo", { ascending: true });

  const hasRealContas = Boolean(contasRaw && contasRaw.length > 0);

  // Amostra padrão caso o usuário ainda não tenha registrado contas
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const formatOffsetDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return format(d, "yyyy-MM-dd");
  };

  const sampleContas = [
    { id: "sample-1", titulo: "Energia Elétrica (CEMIG)", valor: 184.5, valor_pago: 0, prazo: formatOffsetDate(3), importancia: "alta", status: "pendente", forma_pagamento: "boleto" },
    { id: "sample-2", titulo: "Fatura Cartão de Crédito", valor: 1420.0, valor_pago: 0, prazo: formatOffsetDate(5), importancia: "urgente", status: "pendente", forma_pagamento: "pix" },
    { id: "sample-3", titulo: "Internet Fibra 500MB", valor: 99.9, valor_pago: 0, prazo: formatOffsetDate(12), importancia: "media", status: "pendente", forma_pagamento: "debito_automatico" },
    { id: "sample-4", titulo: "Condomínio Residencial", valor: 450.0, valor_pago: 0, prazo: formatOffsetDate(16), importancia: "alta", status: "pendente", forma_pagamento: "boleto" },
  ];

  const displayContas: any[] = hasRealContas ? contasRaw : sampleContas;
  const pendingContas = displayContas.filter((c: any) => c.status !== "pago");
  const getRestante = (c: any) => Math.max(0, Number(c.valor ?? 0) - Number(c.valor_pago ?? 0));
  const totalContasPagar = pendingContas.reduce((sum: number, c: any) => sum + getRestante(c), 0);
  const nextBills = pendingContas.slice(0, 3);

  const incomeCount = transactions?.filter(t => t.type === "income").length ?? 0;
  const expenseCount = transactions?.filter(t => t.type === "expense").length ?? 0;
  const totalIncome  = transactions?.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpense = transactions?.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;
  const netMonth     = totalIncome - totalExpense;
  const totalInvested = investments?.reduce((s, i) => s + (i.current_value ?? i.initial_value), 0) ?? 0;

  // Saldo acumulado e variação em relação ao mês anterior
  const totalBalance = (allRaw ?? []).reduce((s, r) => s + (r.tipo === "entrada" ? 1 : -1) * Number(r.valor), 0);
  const prevBalance = totalBalance - netMonth;
  const variation = prevBalance !== 0 ? (netMonth / Math.abs(prevBalance)) * 100 : null;

  // Fluxo de caixa por mês
  const now = new Date();
  const flow = Array.from({ length: 6 }, (_, idx) => {
    const d = subMonths(now, 5 - idx);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: ptBR }).replace(".", ""), income: 0, expense: 0 };
  });
  (flowRaw ?? []).forEach(r => {
    const m = flow.find(f => f.key === String(r.data).slice(0, 7));
    if (!m) return;
    if (r.tipo === "entrada") m.income += Number(r.valor);
    else m.expense += Number(r.valor);
  });
  const flowMax = Math.max(...flow.map(f => Math.max(f.income, f.expense)), 0);

  // Alocação da carteira por tipo de ativo
  const allocation = Object.entries(
    (investments ?? []).reduce<Record<string, number>>((acc, i) => {
      acc[i.asset_type] = (acc[i.asset_type] ?? 0) + (i.current_value ?? i.initial_value);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const allocColors = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-text-3)"];

  const recentTransactions = transactions?.slice(0, 4) ?? [];
  const budgets = (categoryMonthly ?? []).filter(c => c.category_budget).slice(0, 5);
  const monthLabel = cap(formatMonth(new Date()));

  const getDue = (prazo: string) => {
    const diff = dayDiff(prazo, todayIso);
    if (diff < -1) return { label: `Vencida há ${-diff} dias`, color: "var(--color-danger)" };
    if (diff === -1) return { label: "Vencida ontem", color: "var(--color-danger)" };
    if (diff === 0) return { label: "Vence hoje", color: "var(--color-warning)" };
    if (diff === 1) return { label: "Vence amanhã", color: "var(--color-warning)" };
    return { label: `Vence em ${diff} dias`, color: diff <= 7 ? "var(--color-warning)" : "var(--color-text-2)" };
  };

  const renderBill = (b: any) => {
    const due = getDue(b.prazo);
    const restante = getRestante(b);
    return (
      <Link key={b.id} href="/contas-a-pagar" className="bill-chip">
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="bill-name">{b.titulo}</span>
          <span className="bill-due" style={{ color: due.color }}>
            {due.label}{b.status === "parcial" ? " · Parcial" : ""}
          </span>
        </div>
        <span className="num bill-val">{formatBRL(restante)}</span>
      </Link>
    );
  };

  return (
    <div className="page">
      {/* ================= DESKTOP ================= */}
      <div className="dash-desktop" style={{ display: "contents" }}>
        <header className="page-head">
          <div>
            <h1 className="h1">Painel Financeiro</h1>
            <p className="page-sub">Visão geral das suas finanças em {monthLabel.replace(" ", " de ")}</p>
          </div>
          <div className="head-actions">
            <span className="pill"><Calendar size={16} aria-hidden="true" />{monthLabel}</span>
            <Link href="/lancamentos/novo" className="btn btn-primary" style={{ borderRadius: "var(--radius-md)" }}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Novo Lançamento
            </Link>
          </div>
        </header>

        <div className="summary-row">
          <section className="summary-card" aria-label="Saldo total acumulado">
            <div className="summary-card-top">
              <span className="summary-card-label">Saldo Total Acumulado</span>
              <Wallet size={18} color="var(--color-primary)" aria-hidden="true" />
            </div>
            <div className="num summary-card-value" style={{ color: totalBalance < 0 ? "var(--color-danger)" : "var(--color-text)" }}>
              {formatBRL(totalBalance)}
            </div>
            <div className="summary-card-sub" style={{ color: variation === null ? undefined : variation >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
              {variation === null
                ? "Sem histórico do mês anterior"
                : `${variation >= 0 ? "+" : "−"} ${Math.abs(variation).toFixed(1).replace(".", ",")}% em relação ao mês anterior`}
            </div>
          </section>

          <section className="summary-card" aria-label="Receitas">
            <div className="summary-card-top">
              <span className="summary-card-label">Receitas (Entradas)</span>
              <ArrowDownLeft size={18} color="var(--color-success)" aria-hidden="true" />
            </div>
            <div className="num summary-card-value amount-in">+ {formatBRL(totalIncome)}</div>
            <div className="summary-card-sub">{incomeCount} {incomeCount === 1 ? "lançamento" : "lançamentos"} no mês</div>
          </section>

          <section className="summary-card" aria-label="Despesas">
            <div className="summary-card-top">
              <span className="summary-card-label">Despesas (Saídas)</span>
              <ArrowUpRight size={18} color="var(--color-danger)" aria-hidden="true" />
            </div>
            <div className="num summary-card-value amount-out">− {formatBRL(totalExpense)}</div>
            <div className="summary-card-sub">{expenseCount} {expenseCount === 1 ? "lançamento" : "lançamentos"} no mês</div>
          </section>
        </div>

        <div className="dash-split">
          <div className="dash-col">
            <section className="card" aria-labelledby="fluxo-titulo">
              <div className="section-head" style={{ alignItems: "center" }}>
                <h2 id="fluxo-titulo" className="card-title">Fluxo de Caixa Mensal</h2>
                <div className="legend">
                  <span><i className="legend-dot" style={{ background: "var(--color-success)" }} />Receitas</span>
                  <span><i className="legend-dot" style={{ background: "var(--color-danger)" }} />Despesas</span>
                </div>
              </div>
              {flowMax === 0 ? (
                <p className="muted">Sem movimentação nos últimos 6 meses.</p>
              ) : (
                <div className="flow-chart" role="img" aria-label="Receitas e despesas dos últimos 6 meses">
                  {flow.map(f => (
                    <div key={f.key} className="flow-col">
                      <div className="flow-pair">
                        <span style={{ height: `${(f.income / flowMax) * 100}%`, background: "var(--color-success)" }} title={`Receitas: ${formatBRL(f.income)}`} />
                        <span style={{ height: `${(f.expense / flowMax) * 100}%`, background: "var(--color-danger)" }} title={`Despesas: ${formatBRL(f.expense)}`} />
                      </div>
                      <div className="flow-label">{f.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="ultimos-titulo">
              <div className="section-head" style={{ alignItems: "center" }}>
                <h2 id="ultimos-titulo" className="card-title">Últimos Lançamentos</h2>
                <Link href="/lancamentos" className="link" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>Ver todos →</Link>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="empty" style={{ padding: 0, borderBottom: "none" }}>
                  <div className="empty-title">Nada lançado neste mês</div>
                  <p>Registre a primeira entrada ou saída para ver o saldo e os gastos por categoria.</p>
                  <Link href="/lancamentos/novo" className="btn btn-ghost">Novo lançamento</Link>
                </div>
              ) : (
                recentTransactions.map(t => {
                  const isIn = t.type === "income";
                  return (
                    <div key={t.id} className="entry-row">
                      <div className="entry-left">
                        <span className={`entry-icon ${isIn ? "in" : "out"}`} aria-hidden="true">
                          {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="entry-desc">{t.description}</div>
                          <div className="entry-meta">{t.category?.name ?? "Sem categoria"} • {fullDate(t.date)}</div>
                        </div>
                      </div>
                      <div className={`num entry-val ${isIn ? "amount-in" : "amount-out"}`}>
                        {isIn ? "+" : "−"} {formatBRL(t.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {budgets.length > 0 && (
              <section className="card" aria-labelledby="metas-titulo">
                <h2 id="metas-titulo" className="card-title">Gastos x orçamento</h2>
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
              </section>
            )}
          </div>

          <div className="dash-col">
            <section className="card" aria-labelledby="contas-titulo">
              <div className="section-head" style={{ alignItems: "center" }}>
                <h2 id="contas-titulo" className="card-title">Contas a Pagar Próximas</h2>
                <CalendarClock size={16} color="var(--color-warning)" aria-hidden="true" />
              </div>
              {!hasRealContas && <p className="muted" style={{ fontSize: "var(--text-xs)", fontStyle: "italic" }}>Amostra ilustrativa — cadastre suas contas.</p>}
              {nextBills.length === 0 ? (
                <div className="empty" style={{ padding: 0, borderBottom: "none" }}>
                  <div className="empty-title">Nenhuma conta pendente</div>
                  <p>Todas as contas foram liquidadas ou nenhuma está cadastrada.</p>
                  <Link href="/contas-a-pagar" className="btn btn-ghost">Anotar nova conta</Link>
                </div>
              ) : (
                nextBills.map(renderBill)
              )}
              {nextBills.length > 0 && (
                <Link href="/contas-a-pagar" className="link" style={{ fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Ver todas ({pendingContas.length}) · {formatBRL(totalContasPagar)} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </section>

            <section className="card" aria-labelledby="invest-titulo">
              <div className="section-head" style={{ alignItems: "center" }}>
                <h2 id="invest-titulo" className="card-title">Patrimônio Investido</h2>
                <TrendingUp size={16} color="var(--color-success)" aria-hidden="true" />
              </div>
              <div className="num summary-card-value" style={{ fontSize: "1.5rem" }}>{formatBRL(totalInvested)}</div>
              {allocation.length > 0 ? (
                <div className="alloc-bar" role="img" aria-label="Distribuição da carteira por tipo de ativo">
                  {allocation.map(([tipo, valor], idx) => (
                    <span key={tipo} title={`${tipo}: ${formatBRL(valor)}`} style={{ flex: valor, background: allocColors[Math.min(idx, allocColors.length - 1)] }} />
                  ))}
                </div>
              ) : (
                <Link href="/investimentos/novo" className="link" style={{ fontSize: "var(--text-sm)" }}>Registrar investimento →</Link>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ================= MOBILE ================= */}
      <div className="dash-mobile">
        <section className="m-card" aria-label="Saldo total">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)" }}>Saldo Total</span>
            <span className="pill-sm">{monthLabel}</span>
          </div>
          <div className="num m-balance" style={{ color: totalBalance < 0 ? "var(--color-danger)" : "var(--color-text)" }}>
            {formatBRL(totalBalance)}
          </div>
          <div className="m-row">
            <Link href="/lancamentos/novo" className="btn btn-primary m-btn">
              <Plus size={18} strokeWidth={2} aria-hidden="true" /> Novo
            </Link>
            <Link href="/contas-a-pagar" className="btn m-btn m-btn-ghost">
              <CalendarClock size={18} color="var(--color-warning)" aria-hidden="true" /> Contas
            </Link>
          </div>
        </section>

        <div className="m-row">
          <section className="m-card m-mini" aria-label="Receitas">
            <span className="muted" style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowDownLeft size={14} color="var(--color-success)" aria-hidden="true" /> Receitas
            </span>
            <span className="num m-mini-value amount-in" style={{ textAlign: "left" }}>+ {brlInt(totalIncome)}</span>
          </section>
          <section className="m-card m-mini" aria-label="Despesas">
            <span className="muted" style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowUpRight size={14} color="var(--color-danger)" aria-hidden="true" /> Despesas
            </span>
            <span className="num m-mini-value amount-out" style={{ textAlign: "left" }}>− {brlInt(totalExpense)}</span>
          </section>
        </div>

        <section className="m-card" aria-label="Vencimentos">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 className="card-title">Atenção: Vencimentos</h2>
            <Link href="/contas-a-pagar" className="link" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)", whiteSpace: "nowrap" }}>
              Ver {pendingContas.length} {pendingContas.length === 1 ? "conta" : "contas"} →
            </Link>
          </div>
          {nextBills.length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>Nenhuma conta pendente.</p>
          ) : (
            nextBills.slice(0, 2).map(renderBill)
          )}
        </section>
      </div>
    </div>
  );
}
