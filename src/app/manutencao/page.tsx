import { Wrench } from "lucide-react";
import { StateScreen } from "@/components/ui/state-screen";

export const metadata = {
  title: "Manutenção programada | Reservei",
};

export default function ManutencaoPage() {
  return (
    <StateScreen
      icon={Wrench}
      title="Estamos em manutenção."
      description="Estamos fazendo uma atualização programada. O sistema volta a funcionar normalmente em instantes — tente novamente daqui a pouco."
    />
  );
}
