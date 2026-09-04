import { DumbbellIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Treinos" };

export default function TreinosPage() {
  return (
    <PlaceholderPage
      eyebrow="Programação"
      title="Treinos"
      description="Monte treinos personalizados, organize por dia da semana e acompanhe a execução."
      icon={DumbbellIcon}
      emptyTitle="Criação de treinos em construção"
      emptyDescription="Aqui você vai montar treinos por aluno, com séries, repetições, carga e ordem dos exercícios."
    />
  );
}
