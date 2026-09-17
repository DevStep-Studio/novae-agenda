import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { StateScreen } from "@/components/ui/state-screen";

export const metadata = {
  title: "Página não encontrada | Reservei",
};

export default function NotFound() {
  return (
    <StateScreen
      icon={FileQuestion}
      title="Página não encontrada."
      description="O endereço que você acessou não existe ou foi movido."
      actions={
        <Link href="/" className="state-screen-btn">
          Voltar ao início
        </Link>
      }
    />
  );
}
