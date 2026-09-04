import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novae | Gestão e Agendamento Comercial",
  description: "Sistema comercial completo de agenda, multiunidade, financeiro e clientes.",
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
