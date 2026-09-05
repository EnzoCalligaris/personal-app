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

/* -------------------------------------------------------------------------
   Datas de calendário (sem hora)

   A programação trabalha com dias do calendário, não com instantes. Guardar e
   comparar essas datas em UTC evita que o fuso do servidor empurre um treino
   para o dia anterior ou seguinte.
   ------------------------------------------------------------------------- */

/** "2026-09-07" -> Date em 2026-09-07T00:00:00Z. */
export function dataUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Date -> "2026-09-07" (sempre pela leitura UTC). */
export function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** O dia de hoje no calendário local, normalizado como data UTC. */
export function hojeUTC(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

/** Dia da semana de uma data de calendário. */
export function diaSemanaDeDataUTC(data: Date): DiaSemana {
  return DIAS_SEMANA[data.getUTCDay()];
}

export function somarDiasUTC(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

/** Todas as datas do intervalo, inclusive nas pontas. */
export function intervaloDeDatas(de: Date, ate: Date): Date[] {
  const datas: Date[] = [];
  for (let atual = de; atual <= ate; atual = somarDiasUTC(atual, 1)) {
    datas.push(atual);
  }
  return datas;
}
