"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/actions/transactions";
import type { Category } from "@/types/database";
import Link from "next/link";

export default function NovoLancamentoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [form, setForm] = useState({
    description: "", amount: "", type: "expense",
    category_id: "", date: new Date().toISOString().split("T")[0],
    is_recurring: false, recurrence_rule: "monthly", recurrence_end: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("categories").select("*").eq("user_id", user!.id).neq("type", "investment").order("name");
      setCategories(data ?? []);
    }
    load();
  }, []);

  const filtered = categories.filter(c => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError("");

    startTransition(async () => {
      const result = await createTransaction(form);

      if (result.success) {
        router.push("/lancamentos");
        router.refresh();
        return;
      }

      if (result.errors) {
        setFieldErrors(result.errors);
      } else {
        setGlobalError(result.message ?? "Erro ao salvar lançamento.");
      }
    });
  }

  const loading = isPending;

  return (
    <div className="page-content">
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <Link href="/lancamentos" style={{ fontSize: 14, color: "var(--color-text-2)", textDecoration: "none" }}>← Voltar</Link>
          <h1 className="page-title">Novo Lançamento</h1>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>

            {/* Tipo */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-2)", marginBottom: 8 }}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ value: "expense", label: "💸 Despesa" }, { value: "income", label: "💰 Receita" }].map(t => (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value, category_id: "" }))}
                    style={{ flex: 1, padding: "10px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid", borderColor: form.type === t.value ? "var(--color-primary)" : "var(--color-border)", background: form.type === t.value ? "var(--color-primary-glow)" : "transparent", color: form.type === t.value ? "var(--color-primary)" : "var(--color-text-2)" }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {fieldErrors.type && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.type}</p>}
            </div>

            {/* Descricao */}
            <div className="input-group">
              <label>Descrição</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Supermercado, Salário..." required />
              {fieldErrors.description && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.description}</p>}
            </div>

            {/* Valor e Data */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="input-group">
                <label>Valor (R$)</label>
                <input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
                {fieldErrors.amount && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.amount}</p>}
              </div>
              <div className="input-group">
                <label>Data</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                {fieldErrors.date && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.date}</p>}
              </div>
            </div>

            {/* Categoria */}
            <div className="input-group">
              <label>Categoria</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Sem categoria</option>
                {filtered.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            {/* Recorrencia */}
            <div style={{ marginBottom: 24, padding: 16, background: "var(--color-surface-2)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: form.is_recurring ? 16 : 0 }}>
                <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }} />
                <label htmlFor="recurring" style={{ fontSize: 14, fontWeight: 500, cursor: "pointer" }}>🔁 Lançamento recorrente</label>
              </div>
              {form.is_recurring && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Frequência</label>
                    <select value={form.recurrence_rule} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value }))}>
                      <option value="monthly">Mensal</option>
                      <option value="weekly">Semanal</option>
                    </select>
                    {fieldErrors.recurrence_rule && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.recurrence_rule}</p>}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Encerrar em (opcional)</label>
                    <input type="date" value={form.recurrence_end} onChange={e => setForm(f => ({ ...f, recurrence_end: e.target.value }))} />
                    {fieldErrors.recurrence_end && <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>{fieldErrors.recurrence_end}</p>}
                  </div>
                </div>
              )}
            </div>

            {globalError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 16, textAlign: "center" }}>{globalError}</p>}

            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/lancamentos" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "12px" }}>Cancelar</Link>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: "center", padding: "12px" }}>
                {loading ? "Salvando..." : "Salvar lançamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
