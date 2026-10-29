"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/actions/transactions";
import type { Category, CategoriaRow } from "@/types/database";
import { mapCategoria } from "@/lib/data/mappers";
import Link from "next/link";

export default function NovoLancamentoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [form, setForm] = useState({
    description: "", amount: "", type: "income",
    category_id: "", date: new Date().toISOString().split("T")[0],
    is_recurring: false,
  });

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
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
        setGlobalError(result.message ?? "Erro ao salvar lancamento.");
      }
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", height: 48,
    background: "var(--color-surface-2)",
    border: "none", outline: "1px solid var(--color-border)", outlineOffset: "-0.5px",
    borderRadius: 8, padding: "0 16px",
    fontSize: 16, color: "var(--color-text)", fontFamily: "inherit",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative", padding: "var(--sp-6) var(--sp-4) calc(var(--sp-12) + 68px)", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: "var(--color-text-2)", marginBottom: 4 }}>{currentDate}</div>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", margin: "0 0 8px" }}>
          Novo lançamento
        </h1>
        <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
          Registre uma entrada ou saída no seu livro-caixa.
        </div>
      </div>

      <div style={{ width: "100%", height: 1, background: "var(--color-border)", marginBottom: 24 }} />

      {/* FORM CARD */}
      <div style={{
        width: "100%",
        maxWidth: 584,
        background: "var(--color-surface-2)",
        outline: "1px solid var(--color-border)", outlineOffset: "-0.5px",
        borderRadius: 8, padding: "var(--sp-6) var(--sp-4)",
        display: "flex", flexDirection: "column", gap: 22,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.3px" }}>
          Dados do lançamento
        </div>

        <form onSubmit={handleSubmit} style={{ display: "contents" }}>

          {/* Segmented Tipo */}
          <div style={{
            width: "100%", height: 48, display: "flex", gap: 4, padding: 4,
            outline: "1px solid var(--color-border)", outlineOffset: "-0.5px", borderRadius: 8,
          }}>
            {[
              { value: "income", label: "Entrada", arrow: "down" },
              { value: "expense", label: "Saida", arrow: "up" },
            ].map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: t.value, category_id: "" }))}
                style={{
                  flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
                  background: form.type === t.value ? "var(--color-primary)" : "transparent",
                  color: form.type === t.value ? "var(--color-on-primary)" : "var(--color-text-2)",
                }}
              >
                <svg viewBox="0 0 14 14" width="16" height="16" fill="currentColor">
                  {t.arrow === "down"
                    ? <path d="M6.90088 2.35156q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.52295l0 3.01123q0 3.42822-0.01367 3.42822-0.01367 0-1.59619-1.58252-1.14844-1.14502-1.38086-1.37061-0.229-0.22559-0.31445-0.25293-0.2085-0.06836-0.42725 0.01709-0.21533 0.08203-0.31445 0.29053-0.04102 0.11279-0.04102 0.23926l0 0.04102q0 0.11279 0.05469 0.19824 0.09912 0.14014 0.46484 0.51611l1.67822 1.68164q2.10205 2.1123 2.18409 2.15332 0.12646 0.07178 0.28027 0.07178 0.15381 0 0.28027-0.07178 0.08203-0.04102 2.18409-2.15332l1.67822-1.68164q0.36572-0.37598 0.46484-0.51611 0.05469-0.08545 0.05469-0.19824l0-0.04102q0-0.12646-0.04102-0.23926-0.09912-0.2085-0.31787-0.29053-0.21533-0.08545-0.42382-0.01708-0.08545 0.02734-0.31788 0.25292-0.229 0.22559-1.37744 1.37061-1.58252 1.58252-1.59619 1.58252-0.01367 0-0.01367-3.42822l0-2.97022q0-0.48877-0.02734-0.54345-0.07178-0.19824-0.25293-0.30079-0.18115-0.10596-0.39307-0.06494z" />
                    : <path d="M6.84619 2.35156q-0.08545 0.01367-0.15723 0.06494-0.06836 0.04785-2.16699 2.14649l-1.66455 1.69531q-0.36572 0.3623-0.46484 0.50244-0.05469 0.08545-0.05469 0.19824l0 0.04102q0 0.23926 0.18115 0.42041 0.11279 0.11279 0.28028 0.14697 0.16748 0.03418 0.32129-0.02051 0.08545-0.02734 0.32128-0.25976 0.23926-0.23242 1.37403-1.36377 1.58252-1.58252 1.59619-1.58252 0.01367 0 0.01367 3.42822l0 3.01123q0 0.44775 0.03418 0.53321 0.0376 0.08203 0.11963 0.16748 0.08545 0.08203 0.18799 0.1333 0.10596 0.04785 0.23242 0.04785 0.12646 0 0.229-0.04785 0.10596-0.05127 0.18799-0.1333 0.08545-0.08545 0.11963-0.16748 0.0376-0.08545 0.0376-0.53321l0-3.01123q0-3.42822 0.01367-3.42822 0.01367 0 1.59619 1.58252 1.13477 1.13135 1.37061 1.36377 0.23926 0.23242 0.32471 0.25976 0.15381 0.05469 0.32128 0.02051 0.16748-0.03418 0.28028-0.14697 0.18115-0.18115 0.18115-0.42041l0-0.04102q0-0.11279-0.05469-0.19824-0.09912-0.14014-0.46484-0.51611l-1.67822-1.68164q-2.10205-2.1123-2.17041-2.14649-0.06836-0.0376-0.16065-0.06494-0.09229-0.02734-0.14014-0.02734-0.04785 0-0.14697 0.02734z" />
                  }
                </svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* Descricao */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Descrição*</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Posto Ipiranga"
              required
              style={fieldStyle}
            />
            {fieldErrors.description && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.description}</p>}
          </div>

          {/* Row: Valor + Categoria */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Valor*</label>
              <input
                type="text" inputMode="decimal"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="R$ 0,00"
                required
                style={fieldStyle}
              />
              {fieldErrors.amount && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.amount}</p>}
            </div>
            <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Categoria*</label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  style={{ ...fieldStyle, appearance: "none", paddingRight: 40, cursor: "pointer" }}
                >
                  <option value="">Sem categoria</option>
                  {filtered.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
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
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
              style={fieldStyle}
            />
            {fieldErrors.date && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{fieldErrors.date}</p>}
          </div>

          {/* Divider */}
          <div style={{ width: "100%", height: 1, background: "var(--color-border)" }} />

          {/* Recorrente */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: form.is_recurring ? "var(--color-primary)" : "transparent",
                outline: form.is_recurring ? "none" : "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {form.is_recurring && (
                  <svg viewBox="0 0 14 14" width="10" height="10" fill="#fff">
                    <path d="M11.48096 2.95313q-0.07178 0.01367-0.12989 0.0581-0.05469 0.04102-3.07617 3.06592l-3.0249 3.00781-1.28857-1.28857q-1.28857-1.28516-1.38086-1.32618-0.08887-0.04443-0.22217-0.04443-0.1333 0-0.23242 0.0376-0.0957 0.03418-0.18799 0.11279-0.08887 0.0752-0.1333 0.1709-0.02734 0.07178-0.03418 0.11279-0.00684 0.04102-0.00684 0.14014l0 0.04102q-0.01367 0.11279 0.04102 0.19824 0.07178 0.10938 0.36572 0.40332 0.19482 0.21191 0.96729 0.98096l1.49707 1.48339q0.28027 0.2666 0.38964 0.33838 0.07178 0.05469 0.18457 0.04102l0.09571 0.01367q0.07178 0 0.14013-0.02734 0.08545-0.07178 0.32129-0.28711 0.23926-0.21875 0.79981-0.76221l2.2832-2.2832q2.08496-2.09863 2.7002-2.71387 0.61524-0.61865 0.64599-0.68701 0.04102-0.08545 0.04102-0.23926 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.18115-0.11963-0.08887-0.0376-0.20849-0.0376-0.11963 0-0.18799 0.02734z" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                Lançamento recorrente
              </span>
            </div>
          </div>

          {/* Note */}
          <div style={{ fontSize: 12, lineHeight: "17px", color: "var(--color-text-2)" }}>
            Campos marcados com * são obrigatórios. Ao salvar, os totais do Painel são atualizados automaticamente.
          </div>

          {globalError && (
            <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0, textAlign: "center" }}>{globalError}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href="/lancamentos"
              style={{
                height: 48, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "center",
                outline: "1px solid var(--color-border)", outlineOffset: "-0.5px", borderRadius: 8,
                fontSize: 14, fontWeight: 600, color: "var(--color-text-2)", textDecoration: "none",
                flex: "1 1 120px",
              }}
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isPending}
              style={{
                height: 48, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--color-primary)", borderRadius: 8, border: "none",
                fontSize: 14, fontWeight: 600, color: "var(--color-on-primary)",
                cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: isPending ? 0.7 : 1,
                boxShadow: "0px 4px 20px 0px var(--color-primary-glow)",
                flex: "1 1 180px",
              }}
            >
              {isPending ? "Salvando..." : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
