import type { DiaSemana } from "@/types";
import { dataDeCalendarioDe, hojeISO, limitesDoDia as limitesNoFuso } from "@/lib/fuso";

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
  return diaSemanaDeDataUTC(dataUTC(dataDeCalendarioDe(date)));
}

export function inicioDoDia(date: Date) {
  return limitesNoFuso(dataDeCalendarioDe(date)).de;
}

export function fimDoDia(date: Date) {
  return limitesNoFuso(dataDeCalendarioDe(date)).ate;
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

/** O dia de hoje no calendário brasileiro, ancorado em meia-noite UTC. */
export function hojeUTC(agora: Date = new Date()): Date {
  return dataUTC(hojeISO(agora));
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

/**
 * Instante -> data de calendário, lida no fuso da aplicação. Um treino
 * executado às 22h de domingo pertence ao domingo, não à segunda que já
 * começou em UTC.
 */
export function dataDoInstante(instante: Date): Date {
  return dataUTC(dataDeCalendarioDe(instante));
}

/**
 * Começo e fim de uma data de calendário, como instantes reais no fuso da
 * aplicação - para filtrar colunas que guardam instante.
 */
export function limitesDoDiaLocal(data: Date): { de: Date; ate: Date } {
  return limitesNoFuso(paraISO(data));
}

/**
 * Lê uma data de calendário vinda do banco (coluna `date`, como
 * `agendamentos.data` ou `bloqueios.data`).
 *
 * O valor já é um dia, ancorado em meia-noite UTC - passá-lo por conversão de
 * fuso o faria escorregar para o dia anterior. É o oposto de
 * `dataDoInstante`, que existe para valores que são um ponto no tempo.
 */
export function dataDeCalendario(valor: Date): string {
  return paraISO(valor);
}
