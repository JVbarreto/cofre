import { createClient } from "@/lib/supabase/server";
import type { TransactionWithCategory, TransacaoRow, CategoriaRow } from "@/types/database";
import { mapTransacaoComCategoria } from "@/lib/data/mappers";
import { Topbar } from "@/components/layout/Topbar";
import { formatBRL } from "@/lib/utils/currency";
import { formatDate, formatMonth, getCurrentMonthRange } from "@/lib/utils/dates";
import Link from "next/link";

export default async function LancamentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { start, end } = getCurrentMonthRange();

  const { data: transacoesRaw } = await supabase
    .from("transacoes")
    .select("*, categoria:categorias(*)")
    .eq("user_id", user!.id)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false }) as unknown as { data: (TransacaoRow & { categoria: CategoriaRow | null })[] | null };
  const transactions: TransactionWithCategory[] | null = transacoesRaw?.map(mapTransacaoComCategoria) ?? null;

  const totalIncome  = (transactions as TransactionWithCategory[] ?? []).filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalExpense = (transactions as TransactionWithCategory[] ?? []).filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "32px 32px", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER ESPECÍFICO DE LANÇAMENTOS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>
            {formatDate(new Date().toISOString())}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
            Lançamentos
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

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        
        {/* Filtro Período */}
        <div style={{ position: "relative", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 18px", width: 220, height: 64, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 6 }}>PERÍODO</div>
          <div style={{ fontSize: 13, color: "var(--color-text)" }}>{formatMonth(new Date())}</div>
          <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-2)" }}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
              <path d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z" />
            </svg>
          </div>
        </div>

        {/* Filtro Categoria */}
        <div style={{ position: "relative", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 18px", width: 240, height: 64, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 6 }}>CATEGORIA</div>
          <div style={{ fontSize: 13, color: "var(--color-text)" }}>Todas</div>
          <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-2)" }}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
              <path d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z" />
            </svg>
          </div>
        </div>

        {/* Filtro Tipo */}
        <div style={{ position: "relative", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 18px", width: 200, height: 64, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 6 }}>TIPO</div>
          <div style={{ fontSize: 13, color: "var(--color-text)" }}>Entradas e saídas</div>
          <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-2)" }}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
              <path d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z" />
            </svg>
          </div>
        </div>

        {/* Busca Descrição */}
        <div style={{ flex: 1, position: "relative", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 18px", height: 64, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 6 }}>DESCRIÇÃO</div>
          <input type="text" placeholder="Buscar lançamento..." style={{ fontSize: 13, color: "var(--color-text)", background: "transparent", border: "none", outline: "none", width: "90%" }} />
          <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-2)" }}>
            <svg viewBox="0 0 14 14" width="16" height="16" fill="currentColor">
              <path d="M6.00537 1.17578q-0.04102 0.01367-0.23584 0.02734-0.57422 0.07178-1.16211 0.29053-0.58789 0.21533-1.09375 0.5503-0.39307 0.2666-0.74853 0.61181-0.35547 0.3418-0.62207 0.7041-0.646 0.92285-0.86817 2.03028-0.05811 0.28027-0.07861 0.46142-0.02051 0.18115-0.02051 0.57422 0 0.43408 0.02734 0.68018 0.02734 0.24268 0.12647 0.59472 0.19482 0.75537 0.60156 1.43555 0.40674 0.67676 0.96729 1.18262 0.40674 0.3623 0.81689 0.60156 0.41357 0.23926 0.91944 0.43408 1.06299 0.39307 2.21826 0.29395 1.15527-0.09912 2.1499-0.65967 0.12646-0.06836 0.33496-0.2085 0.2085-0.14014 0.29395-0.21191l0.05468-0.05469 1.10743 1.10742q1.12109 1.104 1.20312 1.15528 0.08545 0.04785 0.23926 0.04785 0.15381 0 0.23584-0.03418 0.08545-0.0376 0.18115-0.1333 0.09912-0.09912 0.1333-0.18115 0.0376-0.08545 0.0376-0.23926 0-0.15381-0.05127-0.23584-0.04785-0.08545-1.15186-1.20654l-1.10742-1.10743 0.05469-0.06836q0.05811-0.05469 0.19824-0.25293 0.82373-1.23047 0.89209-2.70703 0.07178-1.47656-0.63916-2.76513-0.5332-0.96729-1.42187-1.64405-0.88867-0.68018-1.95508-0.9331-0.29395-0.06836-0.54004-0.09571-0.24268-0.03076-0.60498-0.04443-0.43408 0-0.49219 0z m0.7417 1.17578q0.37939 0.01367 0.79297 0.14014 0.41357 0.12646 0.78955 0.32129 0.7417 0.39307 1.28857 1.08008 0.54687 0.68359 0.75538 1.49707 0.07178 0.28027 0.09228 0.49902 0.02051 0.21533 0.02051 0.50928 0 0.70068-0.19483 1.30224-0.39307 1.16211-1.33984 1.91065-0.94336 0.74853-2.16016 0.875-0.19824 0.01367-0.49218 0.00683-0.29395-0.00684-0.48877-0.03418-0.5332-0.08545-1.03907-0.30761-0.50244-0.22559-0.93652-0.56055-0.14014-0.12646-0.35205-0.3418-0.2085-0.21875-0.33154-0.37256-0.57422-0.76904-0.7417-1.69531-0.08545-0.43408-0.06494-0.90918 0.02051-0.4751 0.11963-0.89551 0.29395-1.14844 1.18945-1.95849 0.89551-0.81348 2.05762-1.02539 0.18115-0.02734 0.42041-0.04102 0.23926-0.01367 0.34863-0.01367l0.2666 0.01367z" />
            </svg>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "24px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>Todos os lançamentos</div>
        <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 6, marginBottom: 24 }}>
          {(transactions as TransactionWithCategory[])?.length || 0} resultados &middot; {formatMonth(new Date())}
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr 3fr 1fr 2fr", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--color-text)", fontSize: 11, fontWeight: 700, color: "var(--color-text-2)", letterSpacing: "1px", marginBottom: 8 }}>
          <div>DATA</div>
          <div>DESCRIÇÃO</div>
          <div>CATEGORIA</div>
          <div>TIPO</div>
          <div style={{ textAlign: "right" }}>VALOR</div>
        </div>

        {!transactions || transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-3)", fontSize: 14 }}>
            Nenhum lançamento encontrado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {transactions.map((t: any) => (
              <Link href={`/lancamentos/${t.id}`} key={t.id} style={{ textDecoration: "none", display: "block" }}>
                <div 
                  className="transaction-row"
                  style={{ 
                    display: "grid", gridTemplateColumns: "1fr 4fr 3fr 1fr 2fr", gap: 16, 
                    alignItems: "center", padding: "16px 12px", margin: "0 -12px",
                    borderBottom: "1px solid var(--color-border)",
                    cursor: "pointer", transition: "background 0.15s", borderRadius: 6
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                    {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>
                    {t.description}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text)" }}>
                    {t.category?.name ?? "Sem categoria"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.type === "income" ? "var(--color-success)" : "var(--color-danger)" }}>
                    {t.type === "income" ? "Entrada" : "Saída"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, textAlign: "right", color: t.type === "income" ? "var(--color-success)" : "var(--color-danger)" }}>
                    {t.type === "income" ? "" : "– "}{formatBRL(t.amount)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

