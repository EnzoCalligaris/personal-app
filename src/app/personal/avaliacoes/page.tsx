import { ActivityIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Avaliações" };

export default function AvaliacoesPage() {
  return (
    <PlaceholderPage
      eyebrow="Bioimpedância"
      title="Avaliações"
      description="Registre avaliações de bioimpedância e acompanhe a evolução de cada aluno."
      icon={ActivityIcon}
      emptyTitle="Avaliações em construção"
      emptyDescription="O registro de medidas, os gráficos de evolução e os feedbacks chegam na fase de avaliações."
    />
  );
}
