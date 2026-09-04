import { DumbbellIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Meu treino" };

export default function MeuTreinoPage() {
  return (
    <PlaceholderPage
      eyebrow="Hoje"
      title="Meu treino"
      description="O treino do dia, organizado por exercício, com séries, repetições e carga."
      icon={DumbbellIcon}
      emptyTitle="Seu treino aparecerá aqui"
      emptyDescription="Assim que seu Personal montar sua ficha, ela aparece nesta tela para você executar e marcar como concluída."
    />
  );
}
