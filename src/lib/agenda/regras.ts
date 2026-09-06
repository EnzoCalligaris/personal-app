import type { RegrasAgendamento } from "@/types/agenda";

/**
 * Valem para todo Personal que ainda não configurou nada. São conservadores de
 * propósito: o aluno marca sozinho, mas com meio dia de antecedência.
 */
export const REGRAS_PADRAO: RegrasAgendamento = {
  permiteAgendamento: true,
  antecedenciaMinHoras: 12,
  janelaDias: 30,
  cancelamentoMinHoras: 12,
  maxAtivosPorAluno: 3,
  confirmacaoAutomatica: false,
  duracaoPadraoMin: 60,
};

/** O instante em que o atendimento começa, a partir da data e da hora. */
export function instanteDoAtendimento(dataISO: string, horaInicio: string): Date {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const [hora, minuto] = horaInicio.split(":").map(Number);
  return new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
}

function emHoras(milissegundos: number) {
  return milissegundos / (60 * 60 * 1000);
}

export type MotivoRecusa =
  | "AGENDAMENTO_DESATIVADO"
  | "PASSADO"
  | "ANTECEDENCIA"
  | "FORA_DA_JANELA"
  | "LIMITE_ATINGIDO";

/**
 * O aluno pode marcar este horário? Devolve `null` quando pode - e o motivo,
 * quando não. Estas checagens valem só para o aluno: o Personal continua dono
 * da própria agenda e marca quando quiser.
 */
export function motivoParaNaoAgendar(
  inicio: Date,
  regras: RegrasAgendamento,
  agora: Date = new Date()
): MotivoRecusa | null {
  if (!regras.permiteAgendamento) return "AGENDAMENTO_DESATIVADO";
  if (inicio.getTime() <= agora.getTime()) return "PASSADO";

  const horasAte = emHoras(inicio.getTime() - agora.getTime());
  if (horasAte < regras.antecedenciaMinHoras) return "ANTECEDENCIA";

  const limite = new Date(agora);
  limite.setDate(limite.getDate() + regras.janelaDias);
  if (inicio.getTime() > limite.getTime()) return "FORA_DA_JANELA";

  return null;
}

/** O aluno pode cancelar ou reagendar este atendimento? */
export function podeDesmarcar(
  inicio: Date,
  regras: RegrasAgendamento,
  agora: Date = new Date()
): boolean {
  return emHoras(inicio.getTime() - agora.getTime()) >= regras.cancelamentoMinHoras;
}

export const MENSAGEM_RECUSA: Record<MotivoRecusa, string> = {
  AGENDAMENTO_DESATIVADO: "Seu Personal prefere marcar os horários. Fale com ele para agendar.",
  PASSADO: "Este horário já passou.",
  ANTECEDENCIA: "Este horário está fora da antecedência mínima definida pelo seu Personal.",
  FORA_DA_JANELA: "Esta data está além do período liberado para agendamento.",
  LIMITE_ATINGIDO: "Você atingiu o limite de atendimentos marcados. Cancele um para marcar outro.",
};
