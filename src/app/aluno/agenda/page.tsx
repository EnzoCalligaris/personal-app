import { CalendarDaysIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Agenda" };

export default function AlunoAgendaPage() {
  return (
    <PlaceholderPage
      eyebrow="Atendimentos"
      title="Agenda"
      description="Agende, cancele ou reagende seus horários com o Personal."
      icon={CalendarDaysIcon}
      emptyTitle="Agendamentos em construção"
      emptyDescription="Aqui você verá os horários disponíveis do seu Personal e seus agendamentos confirmados."
    />
  );
}
