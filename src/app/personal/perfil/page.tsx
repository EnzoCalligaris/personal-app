import { UserRoundIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Meu perfil" };

export default function PerfilPage() {
  return (
    <PlaceholderPage
      eyebrow="Conta"
      title="Meu perfil"
      description="Seus dados profissionais, CREF e preferências da conta."
      icon={UserRoundIcon}
      emptyTitle="Perfil em construção"
      emptyDescription="A edição de dados do perfil será liberada junto com a gestão de conta."
    />
  );
}
