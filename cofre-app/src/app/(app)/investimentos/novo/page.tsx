"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvestment } from "@/lib/actions/investments";
import Link from "next/link";

export default function NovoInvestimentoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [form, setForm] = useState({
    name: "", asset_type: "renda_fixa", institution: "",
    initial_value: "", current_value: "", purchase_date: new Date().toISOString().split("T")[0], maturity_date: "", notes: "",
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

  const loading = isPending;
  const inputStyle = { width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "var(--color-text)", fontFamily: "inherit", outline: "none" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-2)", marginBottom: 8 } as React.CSSProperties;
  const errorStyle = { fontSize: 12, color: "var(--color-danger)", marginTop: 4 };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <Link href="/investimentos" style={{ fontSize: 14, color: "var(--color-text-2)", textDecoration: "none" }}>← Voltar</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Novo Ativo</h1>
        </div>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 18, padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nome do ativo</label>
              <input style={inputStyle} type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tesouro Selic 2027" required />
              {fieldErrors.name && <p style={errorStyle}>{fieldErrors.name}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Classe</label>
                <select style={inputStyle} value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}>
                  <option value="renda_fixa">Renda Fixa</option>
                  <option value="acoes">Ações</option>
                  <option value="fundos">Fundos</option>
                  <option value="cripto">Cripto</option>
                  <option value="outros">Outros</option>
                </select>
                {fieldErrors.asset_type && <p style={errorStyle}>{fieldErrors.asset_type}</p>}
              </div>
              <div>
                <label style={labelStyle}>Instituição</label>
                <input style={inputStyle} type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="Ex: Nubank, XP..." />
                {fieldErrors.institution && <p style={errorStyle}>{fieldErrors.institution}</p>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Valor investido (R$)</label>
                <input style={inputStyle} type="text" inputMode="decimal" value={form.initial_value} onChange={e => setForm(f => ({ ...f, initial_value: e.target.value }))} placeholder="0,00" required />
                {fieldErrors.initial_value && <p style={errorStyle}>{fieldErrors.initial_value}</p>}
              </div>
              <div>
                <label style={labelStyle}>Valor atual (R$)</label>
                <input style={inputStyle} type="text" inputMode="decimal" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} placeholder="Deixe vazio se igual ao inicial" />
                {fieldErrors.current_value && <p style={errorStyle}>{fieldErrors.current_value}</p>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Data de compra</label>
                <input style={inputStyle} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} required />
                {fieldErrors.purchase_date && <p style={errorStyle}>{fieldErrors.purchase_date}</p>}
              </div>
              <div>
                <label style={labelStyle}>Vencimento (opcional)</label>
                <input style={inputStyle} type="date" value={form.maturity_date} onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))} />
                {fieldErrors.maturity_date && <p style={errorStyle}>{fieldErrors.maturity_date}</p>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Observações</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Taxa, rentabilidade, estratégia..." />
              {fieldErrors.notes && <p style={errorStyle}>{fieldErrors.notes}</p>}
            </div>
            {globalError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 16, textAlign: "center" }}>{globalError}</p>}
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/investimentos" style={{ flex: 1, textAlign: "center", padding: "12px", borderRadius: 6, fontSize: 14, fontWeight: 600, border: "1px solid var(--color-border)", color: "var(--color-text-2)", textDecoration: "none" }}>Cancelar</Link>
              <button type="submit" disabled={loading} style={{ flex: 2, background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Salvando..." : "Salvar ativo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
