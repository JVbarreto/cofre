import type { Investment, InvestimentoRow } from "@/types/database";
import { mapInvestimento } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils/currency";
import Link from "next/link";
import { Plus } from "lucide-react";

const ASSET_LABELS: Record<string, string> = {
  renda_fixa: "Renda fixa", renda_variavel: "Renda variável", poupanca: "Poupança",
};

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
  const totalPatrimony = investments.reduce((s, i) => s + value(i), 0);
  const totalInitial   = investments.reduce((s, i) => s + i.initial_value, 0);
  const totalReturn    = totalPatrimony - totalInitial;
  const returnPct      = totalInitial > 0 ? (totalReturn / totalInitial) * 100 : 0;

  // Agrupar por tipo
  const grouped = investments.reduce((acc, inv) => {
    acc[inv.asset_type] = (acc[inv.asset_type] ?? 0) + value(inv);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Carteira</div>
          <h1 className="h1">Investimentos</h1>
        </div>
        <Link href="/investimentos/novo" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Novo ativo
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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: "var(--sp-12)" }} className="dash-grid">
            <section className="section" aria-labelledby="total-titulo">
              <h2 id="total-titulo" className="eyebrow">Total investido</h2>
              <div
                className="num"
                style={{
                  fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: "var(--weight-strong)",
                  letterSpacing: "var(--tracking-tight)", lineHeight: "var(--leading-title)", textAlign: "left",
                }}
              >
                {formatBRL(totalPatrimony)}
              </div>
              <p className="muted">
                <span className={`num ${totalReturn >= 0 ? "amount-in" : "amount-out"}`}>
                  {totalReturn >= 0 ? "+" : "−"} {formatBRL(Math.abs(totalReturn))} ({returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%)
                </span>{" "}
                sobre o valor aplicado de {formatBRL(totalInitial)}
              </p>
            </section>

            <section className="section" aria-labelledby="alocacao-titulo">
              <h2 id="alocacao-titulo" className="eyebrow">Alocação por tipo</h2>
              <dl className="ledger">
                {Object.entries(grouped).map(([type, total]) => (
                  <div key={type} className="ledger-row">
                    <dt>{ASSET_LABELS[type] ?? type}</dt>
                    <dd className="num">
                      {formatBRL(total)}
                      <span className="muted" style={{ marginLeft: "var(--sp-3)" }}>
                        {totalPatrimony > 0 ? ((total / totalPatrimony) * 100).toFixed(0) : 0}%
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="section" aria-labelledby="ativos-titulo">
            <h2 id="ativos-titulo" className="h2">Ativos</h2>
            <div className="table cols-inv">
              <div className="table-head">
                <div>Ativo</div><div>Tipo</div><div className="num">Valor aplicado</div><div className="num">Valor atual</div>
              </div>
              {investments.map(inv => (
                <div key={inv.id} className="table-row">
                  <div className="strong">{inv.name}</div>
                  <div className="muted">{ASSET_LABELS[inv.asset_type] ?? inv.asset_type}</div>
                  <div className="muted num">{formatBRL(inv.initial_value)}</div>
                  <div className="num strong">{formatBRL(value(inv))}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
