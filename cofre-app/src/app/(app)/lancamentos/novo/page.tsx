"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/actions/transactions";
import type { Category, CategoriaRow } from "@/types/database";
import { mapCategoria } from "@/lib/data/mappers";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";

export default function NovoLancamentoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [form, setForm] = useState({
    description: "", amount: "", type: "expense",
    category_id: "", date: new Date().toISOString().split("T")[0],
    is_recurring: false,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("categorias").select("*")
        .eq("user_id", user!.id).neq("tipo", "investimento").order("nome") as unknown as { data: CategoriaRow[] | null };
      setCategories((data ?? []).map(mapCategoria));
    }
    load();
  }, []);

  // Esc fecha o modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/lancamentos");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const filtered = categories.filter(c => c.type === form.type);
  const isExpense = form.type === "expense";
  const accent = isExpense ? "var(--color-danger)" : "var(--color-success)";

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
        setGlobalError(result.message ?? "Erro ao salvar lancamento.");
      }
    });
  }

  return (
    <>
      {/* Tela de fundo esmaecida (a lista de lançamentos fica "atrás" do modal) */}
      <div className="modal-ghost" aria-hidden="true">
        <h1 className="h1">Lançamentos</h1>
        <p className="page-sub">Histórico completo de entradas e saídas do livro-caixa</p>
      </div>

      <div
        className="modal-backdrop"
        onClick={e => { if (e.target === e.currentTarget) router.push("/lancamentos"); }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="novo-lancamento-titulo" className="modal">
          <span className="sheet-handle" aria-hidden="true" />

          <div className="modal-head">
            <div>
              <h2 id="novo-lancamento-titulo" className="modal-title">Novo Lançamento</h2>
              <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
                Preencha os dados do registro no livro-caixa
              </p>
            </div>
            <Link href="/lancamentos" className="icon-btn" aria-label="Fechar">
              <X size={18} aria-hidden="true" />
            </Link>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {/* Tipo */}
            <div className="type-toggle" role="group" aria-label="Tipo de lançamento">
              <button
                type="button" className="out" aria-pressed={isExpense}
                onClick={() => setForm(f => ({ ...f, type: "expense", category_id: "" }))}
              >
                <ArrowUpRight size={14} aria-hidden="true" /> Despesa<span className="only-d"> (Saída)</span>
              </button>
              <button
                type="button" className="in" aria-pressed={!isExpense}
                onClick={() => setForm(f => ({ ...f, type: "income", category_id: "" }))}
              >
                <ArrowDownLeft size={14} aria-hidden="true" /> Receita<span className="only-d"> (Entrada)</span>
              </button>
            </div>

            {/* Valor */}
            <div className="field">
              <label htmlFor="lanc-valor" className="field-label">Valor do lançamento</label>
              <div className="amount-field">
                <span className="cur" style={{ color: accent }}>R$</span>
                <input
                  id="lanc-valor"
                  type="text" inputMode="decimal"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                  required
                />
              </div>
              {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
            </div>

            {/* Descrição */}
            <div className="field">
              <label htmlFor="lanc-desc" className="field-label">Descrição</label>
              <input
                id="lanc-desc"
                type="text" className="input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Posto Ipiranga"
                required
              />
              {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
            </div>

            {/* Data + Categoria */}
            <div className="field-row">
              <div className="field">
                <label htmlFor="lanc-data" className="field-label">Data</label>
                <input
                  id="lanc-data"
                  type="date" className="input"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
                {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
              </div>
              <div className="field">
                <label htmlFor="lanc-cat" className="field-label">Categoria</label>
                <select
                  id="lanc-cat" className="input"
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Sem categoria</option>
                  {filtered.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Recorrente */}
            <label className="check" style={{ fontSize: "var(--text-sm)" }}>
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
              />
              Lançamento recorrente
            </label>

            {globalError && <p className="form-error" role="alert">{globalError}</p>}

            <div className="modal-actions">
              <Link href="/lancamentos" className="btn btn-ghost only-d">Cancelar</Link>
              <button type="submit" disabled={isPending} className="btn btn-primary">
                {isPending ? "Salvando..." : "Salvar Lançamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
