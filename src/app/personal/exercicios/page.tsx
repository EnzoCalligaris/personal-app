import { ListChecksIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Exercícios" };

export default function ExerciciosPage() {
  return (
    <PlaceholderPage
      eyebrow="Biblioteca"
      title="Exercícios"
      description="Sua biblioteca de exercícios, com grupo muscular, vídeo de referência e observações."
      icon={ListChecksIcon}
      emptyTitle="Biblioteca de exercícios em construção"
      emptyDescription="A biblioteca reutilizável de exercícios chega junto com a criação de treinos."
    />
  );
}
