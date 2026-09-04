import { UserRoundIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Meu perfil" };

export default function AlunoPerfilPage() {
  return (
    <PlaceholderPage
      eyebrow="Conta"
      title="Meu perfil"
      description="Seus dados, objetivo de treino e preferências da conta."
      icon={UserRoundIcon}
      emptyTitle="Perfil em construção"
      emptyDescription="A edição dos seus dados será liberada junto com a gestão de conta."
    />
  );
}
