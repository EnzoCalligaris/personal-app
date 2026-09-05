import type { StatusAgendamento } from "@/types";

type EstiloStatus = {
  label: string;
  variant: "info" | "warning" | "success" | "destructive" | "secondary";
};

/** Rótulo e cor de cada status, iguais na agenda do Personal e na do aluno. */
export const STATUS_AGENDAMENTO: Record<StatusAgendamento, EstiloStatus> = {
  AGENDADO: { label: "Aguardando confirmação", variant: "info" },
  CONFIRMADO: { label: "Confirmado", variant: "success" },
  REAGENDADO: { label: "Reagendado", variant: "warning" },
  REALIZADO: { label: "Realizado", variant: "secondary" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};

/** Status que ainda ocupam o horário na agenda. */
export const STATUS_ATIVOS = ["AGENDADO", "CONFIRMADO", "REAGENDADO"] as const;

export function ocupaHorario(status: StatusAgendamento) {
  return (STATUS_ATIVOS as readonly StatusAgendamento[]).includes(status);
}
