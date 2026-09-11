import Link from "next/link";
import { NovaeLogo } from "@/components/brand/novae-logo";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Página não encontrada | Reservei",
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#f5f5f5",
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 20,
      }}
    >
      <NovaeLogo size={36} />
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Página não encontrada.</h1>
      <p style={{ color: "#9db8ac", fontSize: 15, maxWidth: 420, margin: 0 }}>
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          color: "#dcff4c",
          textDecoration: "none",
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        <ArrowLeft size={16} /> Voltar ao início
      </Link>
    </div>
  );
}
