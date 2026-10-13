"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvestment } from "@/lib/actions/investments";
import Link from "next/link";

const ASSET_TYPES = [
  { value: "renda_fixa", label: "Renda Fixa" },
  { value: "renda_variavel", label: "Renda Variável" },
  { value: "poupanca", label: "Poupança" },
];

export default function NovoInvestimentoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [form, setForm] = useState({
    name: "", asset_type: "renda_fixa",
    initial_value: "", current_value: "",
    purchase_date: new Date().toISOString().split("T")[0],
  });

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError("");
    startTransition(async () => {
      const result = await createInvestment(form);
      if (result.success) {
        router.push("/investimentos");
        router.refresh();
        return;
      }
      if (result.errors) {
        setFieldErrors(result.errors);
      } else {
        setGlobalError(result.message ?? "Erro ao salvar ativo.");
      }
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", height: 48,
    background: "var(--color-surface-2)",
    border: "none", outline: "1px solid var(--color-border)", outlineOffset: "-0.5px",
    borderRadius: 8, padding: "0 16px",
    fontSize: 14, color: "var(--color-text)", fontFamily: "inherit",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "32px 32px", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>{currentDate}</div>
        <h1 style={{ fontSize: 44, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", margin: "0 0 8px" }}>
          Novo ativo
        </h1>
        <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
          Cadastre um investimento e alimente o histórico da carteira.
        </div>
      </div>

      <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 32 }} />

      {/* FORM CARD */}
      <div style={{
        width: 584,
        background: "var(--color-surface-2)",
        outline: "1px solid var(--color-border)", outlineOffset: "-0.5px",
        borderRadius: 8, padding: 28,
        display: "flex", flexDirection: "column", gap: 22,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.3px" }}>
          Dados do investimento
        </div>

        <form onSubmit={handleSubmit} style={{ display: "contents" }}>

          {/* Nome do ativo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Nome do ativo*</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Tesouro Selic 2029"
              required
              style={fieldStyle}
            />
            {fieldErrors.name && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.name}</p>}
          </div>

          {/* Row: Valor + Tipo */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Valor*</label>
              <input
                type="text" inputMode="decimal"
                value={form.initial_value}
                onChange={e => setForm(f => ({ ...f, initial_value: e.target.value }))}
                placeholder="R$ 0,00"
                required
                style={fieldStyle}
              />
              {fieldErrors.initial_value && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.initial_value}</p>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Classe*</label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.asset_type}
                  onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}
                  style={{ ...fieldStyle, appearance: "none", paddingRight: 40, cursor: "pointer" }}
                >
                  {ASSET_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--color-text-2)" }}>
                  <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
                    <path d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Data */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Data</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
              required
              style={fieldStyle}
            />
            {fieldErrors.purchase_date && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.purchase_date}</p>}
          </div>

          {/* Divider */}
          <div style={{ width: "100%", height: 1, background: "var(--color-border)" }} />

          {/* Note */}
          <div style={{ fontSize: 12, lineHeight: "17px", color: "var(--color-text-2)" }}>
            Se o valor atual ficar vazio, o sistema assume o valor aplicado.
          </div>

          {globalError && (
            <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0, textAlign: "center" }}>{globalError}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
            <Link
              href="/investimentos"
              style={{
                height: 48, padding: "0 24px", display: "flex", alignItems: "center",
                outline: "1px solid var(--color-border)", outlineOffset: "-0.5px", borderRadius: 8,
                fontSize: 14, fontWeight: 600, color: "var(--color-text-2)", textDecoration: "none",
              }}
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isPending}
              style={{
                height: 48, padding: "0 24px", display: "flex", alignItems: "center",
                background: "var(--color-primary)", borderRadius: 8, border: "none",
                fontSize: 14, fontWeight: 600, color: "#FAFAFA",
                cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: isPending ? 0.7 : 1,
                boxShadow: "0px 4px 24px 0px rgba(110, 86, 232, 0.33)",
              }}
            >
              {isPending ? "Salvando..." : "Salvar ativo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
