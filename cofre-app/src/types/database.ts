export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string | null; avatar_url: string | null; created_at: string; };
        Insert: { id: string; name?: string | null; avatar_url?: string | null; created_at?: string; };
        Update: { id?: string; name?: string | null; avatar_url?: string | null; created_at?: string; };
      };
      categories: {
        Row: { id: string; user_id: string; name: string; type: "income" | "expense" | "investment"; color: string | null; icon: string | null; budget: number | null; created_at: string; };
        Insert: { id?: string; user_id: string; name: string; type: "income" | "expense" | "investment"; color?: string | null; icon?: string | null; budget?: number | null; created_at?: string; };
        Update: { id?: string; user_id?: string; name?: string; type?: "income" | "expense" | "investment"; color?: string | null; icon?: string | null; budget?: number | null; created_at?: string; };
      };
      transactions: {
        Row: { id: string; user_id: string; category_id: string | null; amount: number; type: "income" | "expense"; date: string; description: string; is_recurring: boolean; recurrence_rule: "monthly" | "weekly" | null; recurrence_end: string | null; parent_id: string | null; created_at: string; };
        Insert: { id?: string; user_id: string; category_id?: string | null; amount: number; type: "income" | "expense"; date: string; description: string; is_recurring?: boolean; recurrence_rule?: "monthly" | "weekly" | null; recurrence_end?: string | null; parent_id?: string | null; created_at?: string; };
        Update: { id?: string; user_id?: string; category_id?: string | null; amount?: number; type?: "income" | "expense"; date?: string; description?: string; is_recurring?: boolean; recurrence_rule?: "monthly" | "weekly" | null; recurrence_end?: string | null; parent_id?: string | null; created_at?: string; };
      };
      investments: {
        Row: { id: string; user_id: string; name: string; asset_type: "renda_fixa" | "acoes" | "fundos" | "cripto" | "outros"; institution: string | null; initial_value: number; current_value: number | null; purchase_date: string; maturity_date: string | null; notes: string | null; is_active: boolean; created_at: string; };
        Insert: { id?: string; user_id: string; name: string; asset_type: "renda_fixa" | "acoes" | "fundos" | "cripto" | "outros"; institution?: string | null; initial_value: number; current_value?: number | null; purchase_date: string; maturity_date?: string | null; notes?: string | null; is_active?: boolean; created_at?: string; };
        Update: { id?: string; user_id?: string; name?: string; asset_type?: "renda_fixa" | "acoes" | "fundos" | "cripto" | "outros"; institution?: string | null; initial_value?: number; current_value?: number | null; purchase_date?: string; maturity_date?: string | null; notes?: string | null; is_active?: boolean; created_at?: string; };
      };
      investment_snapshots: {
        Row: { id: string; investment_id: string; user_id: string; value: number; recorded_at: string; created_at: string; };
        Insert: { id?: string; investment_id: string; user_id: string; value: number; recorded_at: string; created_at?: string; };
        Update: { id?: string; investment_id?: string; user_id?: string; value?: number; recorded_at?: string; created_at?: string; };
      };
    };
    Views: {
      monthly_summary: { Row: { user_id: string | null; month: string | null; total_income: number | null; total_expense: number | null; net: number | null; }; };
      category_monthly: { Row: { user_id: string | null; category_id: string | null; category_name: string | null; category_color: string | null; category_icon: string | null; category_budget: number | null; month: string | null; total: number | null; }; };
    };
    Functions: {};
    Enums: {};
  };
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Investment = Database["public"]["Tables"]["investments"]["Row"];
export type InvestmentSnapshot = Database["public"]["Tables"]["investment_snapshots"]["Row"];
export type MonthlySummary = Database["public"]["Views"]["monthly_summary"]["Row"];
export type CategoryMonthly = Database["public"]["Views"]["category_monthly"]["Row"];

export type TransactionWithCategory = Transaction & { category: Category | null };
export type InvestmentWithSnapshots = Investment & { investment_snapshots: InvestmentSnapshot[] };
