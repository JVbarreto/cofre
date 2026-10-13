export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ─── Schema real do banco (Supabase) — nomes em português ─────────────────────

export type TipoCategoriaDB = "entrada" | "saida" | "investimento";
export type TipoTransacaoDB = "entrada" | "saida";
export type TipoInvestimentoDB = "renda_fixa" | "renda_variavel" | "poupanca";

export type CategoriaRow = {
  id: string; user_id: string; nome: string; tipo: TipoCategoriaDB;
  orcamento: number | null; created_at: string;
};
export type TransacaoRow = {
  id: string; user_id: string; categoria_id: string | null; tipo: TipoTransacaoDB;
  descricao: string; valor: number; data: string; recorrente: boolean; created_at: string;
};
export type InvestimentoRow = {
  id: string; user_id: string; nome: string; tipo: TipoInvestimentoDB;
  valor_aplicado: number; valor_atual: number; data_aporte: string; created_at: string;
};

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: CategoriaRow;
        Insert: { id?: string; user_id: string; nome: string; tipo: TipoCategoriaDB; orcamento?: number | null; created_at?: string; };
        Update: { id?: string; user_id?: string; nome?: string; tipo?: TipoCategoriaDB; orcamento?: number | null; created_at?: string; };
      };
      transacoes: {
        Row: TransacaoRow;
        Insert: { id?: string; user_id: string; categoria_id?: string | null; tipo: TipoTransacaoDB; descricao: string; valor: number; data?: string; recorrente?: boolean; created_at?: string; };
        Update: { id?: string; user_id?: string; categoria_id?: string | null; tipo?: TipoTransacaoDB; descricao?: string; valor?: number; data?: string; recorrente?: boolean; created_at?: string; };
      };
      investimentos: {
        Row: InvestimentoRow;
        Insert: { id?: string; user_id: string; nome: string; tipo: TipoInvestimentoDB; valor_aplicado: number; valor_atual: number; data_aporte?: string; created_at?: string; };
        Update: { id?: string; user_id?: string; nome?: string; tipo?: TipoInvestimentoDB; valor_aplicado?: number; valor_atual?: number; data_aporte?: string; created_at?: string; };
      };
    };
    Views: {
      resumo_mensal: { Row: { user_id: string | null; mes: string | null; total_entradas: number | null; total_saidas: number | null; saldo: number | null; }; };
      gastos_categoria_mensal: { Row: { user_id: string | null; categoria_id: string | null; categoria_nome: string | null; categoria_orcamento: number | null; mes: string | null; total: number | null; }; };
      media_gastos_recorrentes: { Row: { user_id: string | null; categoria: string | null; media_mensal: number | null; }; };
    };
    Functions: {};
    Enums: {};
  };
}

// ─── Tipos usados pela interface (mapeados a partir do schema acima) ──────────
// Veja src/lib/data/mappers.ts para a conversão.

export type Category = {
  id: string; user_id: string; name: string; type: "income" | "expense" | "investment";
  color: string | null; icon: string | null; budget: number | null; created_at: string;
};

export type Transaction = {
  id: string; user_id: string; category_id: string | null; amount: number;
  type: "income" | "expense"; date: string; description: string; is_recurring: boolean;
  created_at: string;
};

export type Investment = {
  id: string; user_id: string; name: string; asset_type: TipoInvestimentoDB;
  initial_value: number; current_value: number | null; purchase_date: string; created_at: string;
};

export type MonthlySummary = {
  user_id: string | null; month: string | null; total_income: number | null;
  total_expense: number | null; net: number | null;
};

export type CategoryMonthly = {
  user_id: string | null; category_id: string | null; category_name: string | null;
  category_color: string | null; category_icon: string | null; category_budget: number | null;
  month: string | null; total: number | null;
};

export type TransactionWithCategory = Transaction & { category: Category | null };
