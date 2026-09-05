import type { StatusAgendamento } from "@/types";

type EstiloStatus = {
  label: string;
  /** Versão curta, para listas e colunas estreitas. */
  curto: string;
  variant: "info" | "warning" | "success" | "destructive" | "secondary";
};

/** Rótulo e cor de cada status, iguais na agenda do Personal e na do aluno. */
export const STATUS_AGENDAMENTO: Record<StatusAgendamento, EstiloStatus> = {
  AGENDADO: { label: "Aguardando confirmação", curto: "A confirmar", variant: "info" },
  CONFIRMADO: { label: "Confirmado", curto: "Confirmado", variant: "success" },
  REAGENDADO: { label: "Reagendado", curto: "Reagendado", variant: "warning" },
  REALIZADO: { label: "Realizado", curto: "Realizado", variant: "secondary" },
  CANCELADO: { label: "Cancelado", curto: "Cancelado", variant: "destructive" },
};

/** Status que ainda ocupam o horário na agenda. */
export const STATUS_ATIVOS = ["AGENDADO", "CONFIRMADO", "REAGENDADO"] as const;

export function ocupaHorario(status: StatusAgendamento) {
  return (STATUS_ATIVOS as readonly StatusAgendamento[]).includes(status);
}
