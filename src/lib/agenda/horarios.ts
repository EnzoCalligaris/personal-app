import type { SlotLivre } from "@/types/agenda";

/**
 * Horários são texto "HH:MM" no banco - simples de ler e de comparar. Toda a
 * aritmética acontece em minutos desde a meia-noite.
 */
export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function deMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Dois intervalos [início, fim) se cruzam? */
export function sobrepoe(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string
): boolean {
  return paraMinutos(inicioA) < paraMinutos(fimB) && paraMinutos(inicioB) < paraMinutos(fimA);
}

/**
 * Quebra uma faixa de trabalho em atendimentos de `duracaoMin`. Uma sobra
 * menor que a duração é descartada: não existe atendimento pela metade.
 */
export function gerarSlots(horaInicio: string, horaFim: string, duracaoMin: number): SlotLivre[] {
  if (duracaoMin <= 0) return [];

  const inicio = paraMinutos(horaInicio);
  const fim = paraMinutos(horaFim);
  const slots: SlotLivre[] = [];

  for (let atual = inicio; atual + duracaoMin <= fim; atual += duracaoMin) {
    slots.push({ horaInicio: deMinutos(atual), horaFim: deMinutos(atual + duracaoMin) });
  }

  return slots;
}

/** Remove os slots que cruzam algum intervalo ocupado (agendamento ou bloqueio). */
export function removerOcupados(
  slots: SlotLivre[],
  ocupados: { horaInicio: string; horaFim: string }[]
): SlotLivre[] {
  return slots.filter(
    (slot) =>
      !ocupados.some((ocupado) =>
        sobrepoe(slot.horaInicio, slot.horaFim, ocupado.horaInicio, ocupado.horaFim)
      )
  );
}

/** "08:00" + 60 -> "09:00" */
export function somarMinutos(hora: string, minutos: number): string {
  return deMinutos(paraMinutos(hora) + minutos);
}
