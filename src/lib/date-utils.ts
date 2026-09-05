import type { DiaSemana } from "@/types";

export const DIAS_SEMANA: DiaSemana[] = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
];

export function diaSemanaDe(date: Date): DiaSemana {
  return DIAS_SEMANA[date.getDay()];
}

export function inicioDoDia(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fimDoDia(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function diasAtras(date: Date, dias: number) {
  const d = new Date(date);
  d.setDate(d.getDate() - dias);
  return d;
}
