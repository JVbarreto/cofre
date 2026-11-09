import type { Investment, InvestimentoRow } from "@/types/database";
import { mapInvestimento } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import Link from "next/link";
import { Plus, Wallet, TrendingUp, Layers, ShieldCheck, ChartLine, PiggyBank } from "lucide-react";

const ASSET_LABELS: Record<string, string> = {
  renda_fixa: "Renda Fixa", renda_variavel: "Renda Variável", poupanca: "Poupança",
};
const ASSET_COLORS: Record<string, string> = {
  renda_fixa: "var(--color-primary)", renda_variavel: "var(--color-success)", poupanca: "var(--color-warning)",
};
const ASSET_ICONS: Record<string, typeof ShieldCheck> = {
  renda_fixa: ShieldCheck, renda_variavel: ChartLine, poupanca: PiggyBank,
};

// "2026-10-05" -> "05/10/2026", sem passar por Date (evita deslocar o dia por fuso horário)
const fullDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"} ${Math.abs(n).toFixed(2).replace(".", ",")}%`;

export default async function InvestimentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: investimentosRaw } = await supabase
    .from("investimentos")
    .select("*")
    .eq("user_id", user!.id)
    .order("tipo") as unknown as { data: InvestimentoRow[] | null };
  const investments: Investment[] = investimentosRaw?.map(mapInvestimento) ?? [];

  const value = (i: Investment) => i.current_value ?? i.initial_value;
  const returnOf = (i: Investment) => (i.initial_value > 0 ? ((value(i) - i.initial_value) / i.initial_value) * 100 : 0);
  const totalPatrimony = investments.reduce((s, i) => s + value(i), 0);
  const totalInitial   = investments.reduce((s, i) => s + i.initial_value, 0);
  const totalReturn    = totalPatrimony - totalInitial;
  const returnPct      = totalInitial > 0 ? (totalReturn / totalInitial) * 100 : 0;

  // Agrupar por tipo
  const grouped = Object.entries(
    investments.reduce((acc, inv) => {
      acc[inv.asset_type] = (acc[inv.asset_type] ?? 0) + value(inv);
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);
  const share = (n: number) => (totalPatrimony > 0 ? Math.round((n / totalPatrimony) * 100) : 0);

  const sorted = investments.slice().sort((a, b) => value(b) - value(a));
  const positive = totalReturn >= 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="h1">
            <span className="only-d">Investimentos &amp; Patrimônio</span>
            <span className="only-m">Investimentos</span>
          </h1>
          <p className="page-sub">Acompanhamento de rentabilidade e distribuição de ativos</p>
        </div>
        <Link href="/investimentos/novo" className="btn btn-primary" style={{ borderRadius: "var(--radius-md)" }}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span className="only-d">Novo Investimento</span>
          <span className="only-m">Ativo</span>
        </Link>
      </header>

      {investments.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nenhum ativo cadastrado</div>
          <p>Cadastre um investimento com o valor aplicado e o valor atual para acompanhar a carteira e o retorno.</p>
          <Link href="/investimentos/novo" className="btn btn-ghost">Novo ativo</Link>
        </div>
      ) : (
        <>
          {/* ================= DESKTOP ================= */}
          <div className="dash-desktop" style={{ display: "contents" }}>
            <div className="summary-row">
              <section className="summary-card" aria-label="Patrimônio total investido">
                <div className="summary-card-top">
                  <span className="summary-card-label">Patrimônio Total Investido</span>
                  <Wallet size={18} color="var(--color-primary)" aria-hidden="true" />
                </div>
                <div className="num summary-card-value">{formatBRL(totalPatrimony)}</div>
                <div className="summary-card-sub">Valor aplicado: {formatBRL(totalInitial)}</div>
              </section>

              <section className="summary-card" aria-label="Rentabilidade acumulada">
                <div className="summary-card-top">
                  <span className="summary-card-label">Rentabilidade Acumulada</span>
                  <TrendingUp size={18} color={positive ? "var(--color-success)" : "var(--color-danger)"} aria-hidden="true" />
                </div>
                <div className={`num summary-card-value ${positive ? "amount-in" : "amount-out"}`}>
                  {positive ? "+" : "−"} {Math.abs(returnPct).toFixed(1).replace(".", ",")}%
                </div>
                <div className="summary-card-sub">
                  {positive ? "+" : "−"} {formatBRL(Math.abs(totalReturn))} sobre o valor aplicado
                </div>
              </section>

              <section className="summary-card" aria-label="Ativos na carteira">
                <div className="summary-card-top">
                  <span className="summary-card-label">Ativos na Carteira</span>
                  <Layers size={18} color="var(--color-warning)" aria-hidden="true" />
                </div>
                <div className="num summary-card-value">{investments.length}</div>
                <div className="summary-card-sub">
                  Em {grouped.length} {grouped.length === 1 ? "classe de ativo" : "classes de ativo"}
                </div>
              </section>
            </div>

            <div className="bills-table inv-cols">
              <div className="table-head">
                <div>Ativo &amp; Aplicação</div>
                <div>Classe de Ativo</div>
                <div>Valor Aplicado</div>
                <div>Saldo Atual</div>
                <div>Rentabilidade</div>
              </div>
              {sorted.map(inv => {
                const r = returnOf(inv);
                const Icon = ASSET_ICONS[inv.asset_type] ?? ShieldCheck;
                return (
                  <div key={inv.id} className="table-row">
                    <div className="bill-cell-main">
                      <span className="bill-icon" aria-hidden="true"><Icon size={14} color="var(--color-primary)" /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="bill-title">{inv.name}</div>
                        <div className="bill-sub">Aplicado em {fullDate(inv.purchase_date)}</div>
                      </div>
                    </div>
                    <div><span className="pill-sm">{ASSET_LABELS[inv.asset_type] ?? inv.asset_type}</span></div>
                    <div className="num" style={{ textAlign: "left", color: "var(--color-text-2)", fontSize: "var(--text-sm)" }}>{formatBRL(inv.initial_value)}</div>
                    <div className="num" style={{ textAlign: "left", fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)" }}>{formatBRL(value(inv))}</div>
                    <div>
                      <span
                        className="count-badge"
                        style={{
                          background: r >= 0 ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                          color: r >= 0 ? "var(--color-success)" : "var(--color-danger)",
                        }}
                      >
                        {pct(r)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= MOBILE ================= */}
          <div className="dash-mobile">
            <section className="m-card" aria-label="Patrimônio total investido">
              <span className="muted" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)" }}>Patrimônio Total Investido</span>
              <div className="num m-balance">{formatBRL(totalPatrimony)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  className="count-badge"
                  style={{
                    background: positive ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                    color: positive ? "var(--color-success)" : "var(--color-danger)",
                  }}
                >
                  {positive ? "+" : "−"} {Math.abs(returnPct).toFixed(1).replace(".", ",")}%
                </span>
                <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Aplicado: {formatBRL(totalInitial)}</span>
              </div>
            </section>

            <section className="m-card" aria-label="Distribuição da carteira">
              <h2 className="card-title">Distribuição da Carteira</h2>
              <div className="alloc-bar" role="img" aria-label="Distribuição da carteira por tipo de ativo">
                {grouped.map(([tipo, valor]) => (
                  <span key={tipo} style={{ flex: valor, background: ASSET_COLORS[tipo] ?? "var(--color-text-3)" }} />
                ))}
              </div>
              <div className="alloc-legend">
                {grouped.map(([tipo, valor]) => (
                  <span key={tipo}>
                    <i className="legend-dot" style={{ background: ASSET_COLORS[tipo] ?? "var(--color-text-3)" }} />
                    {ASSET_LABELS[tipo] ?? tipo} ({share(valor)}%)
                  </span>
                ))}
              </div>
            </section>

            {sorted.map(inv => {
              const r = returnOf(inv);
              const Icon = ASSET_ICONS[inv.asset_type] ?? ShieldCheck;
              return (
                <div key={inv.id} className="m-card m-asset">
                  <span className="bill-icon" style={{ width: 40, height: 40 }} aria-hidden="true"><Icon size={18} color="var(--color-primary)" /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="bill-title" style={{ fontSize: "var(--text-base)" }}>{inv.name}</div>
                    <div className="bill-sub">{ASSET_LABELS[inv.asset_type] ?? inv.asset_type}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num m-asset-val">{formatBRL(value(inv))}</div>
                    <div className="num" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)", color: r >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {pct(r)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
