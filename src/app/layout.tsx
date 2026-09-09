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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("agenda-theme")||"dark";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.dataset.theme=r;document.documentElement.dataset.themeMode=t;}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
