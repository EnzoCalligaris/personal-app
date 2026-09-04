import { TrendingUpIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Evolução" };

export default function EvolucaoPage() {
  return (
    <PlaceholderPage
      eyebrow="Bioimpedância"
      title="Evolução"
      description="Seu histórico de avaliações, com gráficos de peso, percentual de gordura e massa magra."
      icon={TrendingUpIcon}
      emptyTitle="Sua evolução aparecerá aqui"
      emptyDescription="Depois da primeira avaliação registrada pelo seu Personal, os gráficos de evolução aparecem nesta tela."
    />
  );
}
