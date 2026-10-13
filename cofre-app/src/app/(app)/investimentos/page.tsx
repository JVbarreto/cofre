import type { Investment, InvestimentoRow } from "@/types/database";
import { mapInvestimento } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { formatBRL } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import Link from "next/link";

const ASSET_LABELS: Record<string, string> = {
  renda_fixa: "Renda Fixa", renda_variavel: "Renda Variável", poupanca: "Poupança",
};
const ASSET_COLORS: Record<string, string> = {
  renda_fixa: "var(--color-primary)", renda_variavel: "var(--color-success)", poupanca: "var(--color-warning)",
};

export default async function InvestimentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  type InvestmentRow = Investment;
  const { data: investimentosRaw } = await supabase
    .from("investimentos")
    .select("*")
    .eq("user_id", user!.id)
    .order("tipo") as unknown as { data: InvestimentoRow[] | null };
  const investments: InvestmentRow[] | null = investimentosRaw?.map(mapInvestimento) ?? null;

  const totalPatrimony = investments?.reduce((s, i) => s + (i.current_value ?? i.initial_value), 0) ?? 0;
  const totalInitial   = investments?.reduce((s, i) => s + i.initial_value, 0) ?? 0;
  const totalReturn    = totalPatrimony - totalInitial;
  const returnPct      = totalInitial > 0 ? (totalReturn / totalInitial) * 100 : 0;

  // Agrupar por tipo
  const grouped = (investments ?? []).reduce((acc, inv) => {
    if (!acc[inv.asset_type]) acc[inv.asset_type] = [];
    acc[inv.asset_type]!.push(inv);
    return acc;
  }, {} as Record<string, InvestmentRow[]>);


  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "32px 32px", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER ESPECÍFICO DE INVESTIMENTOS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>
            {formatDate(new Date().toISOString())}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
            Investimentos
          </h1>
        </div>
      </div>

      <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 32 }} />

      {/* DASHBOARD TOP (Total Investido + Alocação) */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        
        {/* TOTAL INVESTIDO */}
        <div style={{ flex: "0 0 624px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, height: 180, padding: 24, display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px" }}>TOTAL INVESTIDO</div>
          <div style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", marginTop: 12 }}>
            {formatBRL(totalPatrimony)}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
            <div style={{ background: returnPct >= 0 ? "#E7EFE5" : "#FEE2E2", padding: "6px 12px", borderRadius: 3, display: "flex", alignItems: "center", gap: 8 }}>
              {returnPct >= 0 ? (
                <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor" style={{ color: "var(--color-success)" }}>
                  <path d="M9.19775 3.51367q-0.14014 0.04102-0.25976 0.15381-0.11963 0.11279-0.16065 0.25293-0.05469 0.19482 0.02735 0.39307 0.08545 0.19482 0.25293 0.29394 0.09912 0.04102 0.30761 0.05469 0.21191 0.01367 1.00831 0.01367l1.04931 0-3.54101 3.54102-1.30225-1.28516q-1.28857-1.28857-1.38086-1.32959-0.08887-0.04443-0.21533-0.05127-0.12646-0.00684-0.21875 0.03076-0.08887 0.03418-0.37598 0.30762-0.28711 0.27002-1.72949 1.7124-1.97217 1.97559-2.0166 2.04395-0.08203 0.19482-0.04785 0.37939 0.03418 0.18115 0.16064 0.29395 0.15381 0.15381 0.36231 0.17431 0.21191 0.02051 0.37939-0.09228 0.07178-0.05469 1.76367-1.75l1.69531-1.70557 2.35157 2.33789q0.25293 0.23584 0.35205 0.29395 0.06836 0.04102 0.18115 0.04101l0.08203 0q0.09912 0 0.19824-0.05468 0.12646-0.08545 0.4751-0.43409l3.65381-3.64013 0.01367 2.23877 0.04102 0.09912q0.04443 0.08203 0.11279 0.16064 0.07178 0.0752 0.14014 0.1128 0.07178 0.03418 0.16748 0.04785 0.23926 0.04102 0.43408-0.09229 0.19824-0.1333 0.25293-0.36914 0.01367-0.11279 0-1.91748l0-1.82178-0.04102-0.09912q-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-1.86279-0.01367q-1.85937 0-1.93116 0.01367z" />
                </svg>
              ) : (
                <span style={{ color: "var(--color-danger)", fontSize: 14, lineHeight: 1 }}>📉</span>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: returnPct >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}% no total
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-2)", marginLeft: 8 }}>desde o início</div>
          </div>
        </div>

        {/* ALOCAÇÃO */}
        <div style={{ flex: "1 1 auto", maxWidth: 460, display: "flex", flexDirection: "column", gap: 8, height: 180, overflowY: "auto", paddingRight: 4 }}>
          {Object.entries(grouped ?? {}).map(([type, items]) => {
            const total = (items ?? []).reduce((s: number, i: any) => s + (i.current_value ?? i.initial_value), 0);
            const pct = totalPatrimony > 0 ? (total / totalPatrimony) * 100 : 0;
            return (
              <div key={type} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, height: 52, flexShrink: 0, padding: "0 16px", display: "flex", alignItems: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", width: 140 }}>
                  {ASSET_LABELS[type]?.toUpperCase() || type.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", flex: 1, textAlign: "right" }}>
                  {formatBRL(total)}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-2)", width: 120, textAlign: "right" }}>
                  {pct.toFixed(1)}% da carteira
                </div>
              </div>
            );
          })}
          {Object.keys(grouped ?? {}).length === 0 && (
             <div style={{ fontSize: 13, color: "var(--color-text-3)", padding: "16px 0" }}>Nenhum ativo alocado.</div>
          )}
        </div>
      </div>

      {/* EVOLUTION CHART MOCK */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, height: 390, width: 624, padding: 24, display: "flex", flexDirection: "column", marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Evolução do total investido</div>
        <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 6, marginBottom: 40 }}>Últimos 6 meses &middot; valor aplicado acumulado</div>
        
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", paddingBottom: 32, paddingLeft: 12, paddingRight: 12 }}>
          {/* Baseline */}
          <div style={{ position: "absolute", bottom: 31, left: 0, right: 0, height: 1, background: "var(--color-border)" }} />
          
          {/* Bars */}
          {[
            { month: "abr", height: 52 },
            { month: "mai", height: 87 },
            { month: "jun", height: 107 },
            { month: "jul", height: 146 },
            { month: "ago", height: 180 },
            { month: "set", height: 215 },
          ].map(bar => (
            <div key={bar.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>R$</div>
              <div style={{ width: 34, height: bar.height, background: "var(--color-primary)", boxShadow: "0px 0px 12px 0px rgba(110, 86, 232, 0.33)" }} />
              <div style={{ position: "absolute", bottom: 0, fontSize: 12, color: "var(--color-text-2)" }}>{bar.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ASSETS TABLE */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 24, maxWidth: 1108 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", marginBottom: 20 }}>Meus ativos</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 2fr", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--color-text)", fontSize: 11, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 8 }}>
          <div>ATIVO</div>
          <div>TIPO</div>
          <div style={{ textAlign: "right" }}>VALOR APLICADO</div>
          <div style={{ textAlign: "right" }}>VALOR ATUAL</div>
        </div>

        {!investments || investments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-3)", fontSize: 14 }}>
            Nenhum ativo encontrado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {investments.map((inv: any) => {
              const current = inv.current_value ?? inv.initial_value;
              return (
                <Link href={`/investimentos/${inv.id}`} key={inv.id} style={{ textDecoration: "none", display: "block" }}>
                  <div 
                    className="transaction-row"
                    style={{ 
                      display: "grid", gridTemplateColumns: "2fr 2fr 2fr 2fr", gap: 16, 
                      alignItems: "center", padding: "16px 12px", margin: "0 -12px",
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer", transition: "background 0.15s", borderRadius: 6
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                      {inv.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                      {ASSET_LABELS[inv.asset_type] || inv.asset_type}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-2)", textAlign: "right" }}>
                      {formatBRL(inv.initial_value)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-success)", textAlign: "right" }}>
                      {formatBRL(current)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

