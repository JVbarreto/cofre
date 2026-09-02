import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cofre — Controle Financeiro Pessoal",
  description: "Organize suas finanças: entradas, saídas, investimentos e relatórios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
