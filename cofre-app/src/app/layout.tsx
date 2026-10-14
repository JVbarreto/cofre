import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Duas famílias: Fraunces (títulos e marca) e Instrument Sans (texto e números).
// next/font serve os arquivos do próprio domínio, sem depender do Google Fonts na CSP.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cofre — Controle Financeiro Pessoal",
  description: "Organize suas finanças: entradas, saídas, investimentos e relatórios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
