import type { DiaSemana } from "@/types";

const DIA_SEMANA_LABEL: Record<DiaSemana, string> = {
  DOMINGO: "Domingo",
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
};

export function diaSemanaLabel(dia: DiaSemana) {
  return DIA_SEMANA_LABEL[dia];
}

export function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(iso)
  );
}

export function formatarDataCompleta(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(iso));
}

/** "hoje", "ontem", "há 3 dias" ou a data, para períodos maiores. */
export function formatarDataRelativa(iso: string, referencia = new Date()) {
  const data = new Date(iso);
  const umDia = 24 * 60 * 60 * 1000;
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(referencia) - inicio(data)) / umDia);

  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias > 1 && dias < 30) return `há ${dias} dias`;
  if (dias === -1) return "amanhã";
  if (dias < -1 && dias > -30) return `em ${Math.abs(dias)} dias`;
  return formatarData(iso);
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}
