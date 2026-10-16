import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import { getCurrentMonthRange, formatMonth } from "@/lib/utils/dates";
import type { TransactionWithCategory, Investment, CategoryMonthly, TransacaoRow, CategoriaRow, InvestimentoRow, Database } from "@/types/database";
import { mapTransacaoComCategoria, mapInvestimento, mapGastoCategoria } from "@/lib/data/mappers";
import Link from "next/link";
import { Plus, CalendarClock, ArrowRight } from "lucide-react";

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

  // Busca contas a pagar
  const { data: contasRaw } = await (supabase as any)
    .from("contas_pagar")
    .select("*")
    .eq("user_id", user!.id)
    .order("prazo", { ascending: true });

  const hasRealContas = Boolean(contasRaw && contasRaw.length > 0);

  // Amostra padrão caso o usuário ainda não tenha registrado contas
  const formatOffsetDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const sampleContas = [
    {
      id: "sample-1",
      titulo: "Energia Elétrica (CEMIG)",
      valor: 184.5,
      prazo: formatOffsetDate(3),
      importancia: "alta",
      status: "pendente",
      forma_pagamento: "boleto",
    },
    {
      id: "sample-2",
      titulo: "Fatura Cartão de Crédito",
      valor: 1420.0,
      prazo: formatOffsetDate(5),
      importancia: "urgente",
      status: "pendente",
      forma_pagamento: "pix",
    },
    {
      id: "sample-3",
      titulo: "Internet Fibra 500MB",
      valor: 99.9,
      prazo: formatOffsetDate(12),
      importancia: "media",
      status: "pendente",
      forma_pagamento: "debito_automatico",
    },
    {
      id: "sample-4",
      titulo: "Condomínio Residencial",
      valor: 450.0,
      prazo: formatOffsetDate(16),
      importancia: "alta",
      status: "pendente",
      forma_pagamento: "boleto",
    },
  ];

  const displayContas: any[] = hasRealContas ? contasRaw : sampleContas;
  const pendingContas = displayContas.filter((c: any) => c.status === "pendente");
  const totalContasPagar = pendingContas.reduce((sum: number, c: any) => sum + Number(c.valor), 0);
  const nextBills = pendingContas.slice(0, 4);

  const totalIncome  = transactions?.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpense = transactions?.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;
  const netBalance   = totalIncome - totalExpense;
  const totalInvested = investments?.reduce((s, i) => s + (i.current_value ?? i.initial_value), 0) ?? 0;

  const recentTransactions = transactions?.slice(0, 5) ?? [];
  const budgets = (categoryMonthly ?? []).filter(c => c.category_budget).slice(0, 5);

  const todayIso = new Date().toISOString().split("T")[0];
  const getDueBadge = (prazo: string) => {
    if (prazo < todayIso) {
      return { label: `Atrasada (${dayMonth(prazo)})`, badgeClass: "badge-danger" };
    }
    if (prazo === todayIso) {
      return { label: "Vence hoje!", badgeClass: "badge-warning" };
    }
    const [pY, pM, pD] = prazo.split("-").map(Number);
    const [tY, tM, tD] = todayIso.split("-").map(Number);
    const diff = Math.ceil((new Date(pY, pM - 1, pD).getTime() - new Date(tY, tM - 1, tD).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) return { label: `Amanhã (${dayMonth(prazo)})`, badgeClass: "badge-warning" };
    return { label: `Em ${diff} dias (${dayMonth(prazo)})`, badgeClass: "badge" };
  };

  const getImportanciaBadge = (imp: string) => {
    switch (imp) {
      case "urgente": return { label: "🚨 Urgente", color: "var(--color-danger)" };
      case "alta":    return { label: "⚠️ Alta", color: "var(--color-warning)" };
      case "media":   return { label: "🔹 Média", color: "var(--color-primary)" };
      default:        return { label: "⚪ Baixa", color: "var(--color-text-2)" };
    }
  };

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
            <div className="ledger-row">
              <dt>
                <Link href="/contas-a-pagar" className="link" style={{ color: "inherit", textDecoration: "none" }}>
                  Contas a pagar <span className="muted" style={{ fontSize: "var(--text-xs)" }}>({pendingContas.length})</span>
                </Link>
              </dt>
              <dd className="num" style={{ color: "var(--color-warning)" }}>
                {formatBRL(totalContasPagar)}
              </dd>
            </div>
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

      {/* Contas a Pagar: Próximos Vencimentos */}
      <section className="section" aria-labelledby="contas-titulo">
        <div className="section-head">
          <div>
            <h2 id="contas-titulo" className="h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarClock size={20} color="var(--color-primary)" />
              Contas a pagar · Próximos vencimentos
            </h2>
            <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
              {pendingContas.length} {pendingContas.length === 1 ? "conta pendente" : "contas pendentes"} · Total:{" "}
              <span className="num" style={{ color: "var(--color-warning)", fontWeight: "var(--weight-strong)" }}>
                {formatBRL(totalContasPagar)}
              </span>
              {!hasRealContas && (
                <span style={{ marginLeft: 8, fontStyle: "italic", opacity: 0.8 }}>
                  (Amostra ilustrativa)
                </span>
              )}
            </p>
          </div>
          <Link href="/contas-a-pagar" className="link" style={{ fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Ver todas e anotar <ArrowRight size={14} />
          </Link>
        </div>

        {nextBills.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nenhuma conta pendente</div>
            <p>Todas as contas foram liquidadas ou nenhuma está cadastrada para os próximos dias.</p>
            <Link href="/contas-a-pagar" className="btn btn-ghost">Anotar nova conta</Link>
          </div>
        ) : (
          <div className="table" style={{ "--cols": "110px minmax(0, 1.4fr) 130px 110px 130px" } as React.CSSProperties}>
            <div className="table-head">
              <div>Prioridade</div><div>Conta</div><div>Vencimento</div><div>Forma</div><div className="num">Valor</div>
            </div>
            {nextBills.map(b => {
              const due = getDueBadge(b.prazo);
              const imp = getImportanciaBadge(b.importancia);
              return (
                <div key={b.id} className="table-row">
                  <div>
                    <span style={{ color: imp.color, fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)" }}>
                      {imp.label}
                    </span>
                  </div>
                  <div className="strong" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Link href="/contas-a-pagar" style={{ color: "inherit" }}>
                      {b.titulo}
                    </Link>
                  </div>
                  <div>
                    <span className={`badge ${due.badgeClass}`}>
                      {due.label}
                    </span>
                  </div>
                  <div className="muted" style={{ textTransform: "capitalize", fontSize: "var(--text-xs)" }}>
                    {b.forma_pagamento ? b.forma_pagamento.replace("_", " ") : "Boleto"}
                  </div>
                  <div className="num" style={{ fontWeight: "var(--weight-strong)", color: "var(--color-text)" }}>
                    {formatBRL(Number(b.valor))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
