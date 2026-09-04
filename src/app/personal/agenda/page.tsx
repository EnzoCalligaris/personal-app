import { CalendarDaysIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <PlaceholderPage
      eyebrow="Atendimentos"
      title="Agenda"
      description="Defina seus horários disponíveis e acompanhe os agendamentos dos alunos."
      icon={CalendarDaysIcon}
      emptyTitle="Agenda em construção"
      emptyDescription="Disponibilidade, agendamentos, cancelamentos e reagendamentos entram na fase da agenda."
    />
  );
}
