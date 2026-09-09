import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservei",
  description: "Plataforma SaaS profissional de agendamentos, gestão de clientes, equipe e financeiro.",
  icons: {
    icon: "/brand/favicon-32.png",
    shortcut: "/brand/favicon-64.png",
    apple: "/brand/favicon-64.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
