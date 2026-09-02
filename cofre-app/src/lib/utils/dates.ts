import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "dd/MM/yyyy"): string {
  return format(new Date(date), pattern, { locale: ptBR });
}

export function formatMonth(date: string | Date): string {
  return format(new Date(date), "MMMM yyyy", { locale: ptBR });
}

export function getCurrentMonthRange() {
  const now = new Date();
  return {
    start: format(startOfMonth(now), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export function getLastNMonthsRange(n: number) {
  const now = new Date();
  return {
    start: format(startOfMonth(subMonths(now, n - 1)), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export function getMonthLabel(date: string): string {
  return format(new Date(date), "MMM", { locale: ptBR });
}
