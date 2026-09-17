import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { CookieBanner } from "@/components/ui/cookie-banner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

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
      <body>
        <OfflineBanner />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
