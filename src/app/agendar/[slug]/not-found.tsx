import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { b, PublicFrame } from "@/components/booking/primitives";

export default function AgendarNotFound() {
  return (
    <PublicFrame>
      <main className={b.main} style={{ textAlign: "center", padding: "64px 20px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(220, 255, 76, 0.1)",
            border: "1px solid rgba(220, 255, 76, 0.2)",
            color: "var(--booking-primary, #dcff4c)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Search size={24} />
        </div>
        <h1 className={b.title} style={{ fontSize: "24px", marginBottom: "8px" }}>
          Estabelecimento não encontrado
        </h1>
        <p className={b.subtitle} style={{ maxWidth: 440, margin: "0 auto 24px", fontSize: "15px", color: "var(--booking-text-muted, #9db8ac)" }}>
          Não encontramos nenhuma página de agendamento neste endereço. Verifique se o link foi digitado corretamente ou consulte o estabelecimento.
        </p>
        <Link
          href="/"
          className={b.button}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            maxWidth: 240,
            margin: "0 auto",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Voltar ao início
        </Link>
      </main>
    </PublicFrame>
  );
}
