import { UsersRoundIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Alunos" };

export default function AlunosPage() {
  return (
    <PlaceholderPage
      eyebrow="Gestão"
      title="Alunos"
      description="Cadastre alunos, acompanhe o vínculo com você e acesse o histórico de cada um."
      icon={UsersRoundIcon}
      emptyTitle="Gestão de alunos em construção"
      emptyDescription="Esta área receberá o cadastro e o gerenciamento de alunos na próxima fase do projeto."
    />
  );
}
