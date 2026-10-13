import type {
  CategoriaRow, TransacaoRow, InvestimentoRow,
  Category, Transaction, Investment, TransactionWithCategory,
  MonthlySummary, CategoryMonthly, Database,
} from "@/types/database";

type Views = Database["public"]["Views"];

const TIPO_PARA_UI = { entrada: "income", saida: "expense", investimento: "investment" } as const;
export const TIPO_PARA_DB = { income: "entrada", expense: "saida" } as const;

// Postgres devolve numeric como number via PostgREST; Number() protege contra string.
const num = (v: unknown): number => Number(v ?? 0);

export function mapCategoria(c: CategoriaRow): Category {
  return {
    id: c.id, user_id: c.user_id, name: c.nome, type: TIPO_PARA_UI[c.tipo],
    color: null, icon: null, budget: c.orcamento === null ? null : num(c.orcamento),
    created_at: c.created_at,
  };
}

export function mapTransacao(t: TransacaoRow): Transaction {
  return {
    id: t.id, user_id: t.user_id, category_id: t.categoria_id, amount: num(t.valor),
    type: t.tipo === "entrada" ? "income" : "expense", date: t.data,
    description: t.descricao, is_recurring: t.recorrente, created_at: t.created_at,
  };
}

export function mapTransacaoComCategoria(
  t: TransacaoRow & { categoria: CategoriaRow | null }
): TransactionWithCategory {
  return { ...mapTransacao(t), category: t.categoria ? mapCategoria(t.categoria) : null };
}

export function mapInvestimento(i: InvestimentoRow): Investment {
  return {
    id: i.id, user_id: i.user_id, name: i.nome, asset_type: i.tipo,
    initial_value: num(i.valor_aplicado), current_value: num(i.valor_atual),
    purchase_date: i.data_aporte, created_at: i.created_at,
  };
}

export function mapResumoMensal(r: Views["resumo_mensal"]["Row"]): MonthlySummary {
  return {
    user_id: r.user_id, month: r.mes, total_income: num(r.total_entradas),
    total_expense: num(r.total_saidas), net: num(r.saldo),
  };
}

export function mapGastoCategoria(r: Views["gastos_categoria_mensal"]["Row"]): CategoryMonthly {
  return {
    user_id: r.user_id, category_id: r.categoria_id, category_name: r.categoria_nome,
    category_color: null, category_icon: null,
    category_budget: r.categoria_orcamento === null ? null : num(r.categoria_orcamento),
    month: r.mes, total: num(r.total),
  };
}
