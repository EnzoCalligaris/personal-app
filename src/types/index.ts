export type Role = "PERSONAL" | "ALUNO";

export type DiaSemana =
  | "DOMINGO"
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO";

export type StatusAgendamento =
  /** Marcado, à espera do aceite do Personal. */
  | "AGENDADO"
  | "CONFIRMADO"
  | "CANCELADO"
  | "REALIZADO"
  /** Movido de horário - continua valendo, à espera de confirmação. */
  | "REAGENDADO";
