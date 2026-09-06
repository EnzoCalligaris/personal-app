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

/** ["SEGUNDA","QUINTA"] -> "Segunda, Quinta"; vazio -> "Sem dia definido". */
export function diasProgramadosLabel(dias: DiaSemana[]) {
  return dias.length ? dias.map(diaSemanaLabel).join(", ") : "Sem dia na programação";
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

/** 62.4 -> "62,4 kg" */
export function formatarPeso(peso: number) {
  return `${peso.toLocaleString("pt-BR")} kg`;
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

/**
 * Datas de calendário ("2026-09-07") viram Date no fuso local, não em UTC:
 * `new Date("2026-09-07")` seria meia-noite UTC e, num fuso negativo, cairia
 * no dia 06 na hora de formatar.
 */
function dataLocalDe(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** "2026-09-07" -> "07 de set." */
export function formatarDataCalendario(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    dataLocalDe(iso)
  );
}

/** "2026-09-07" -> "segunda-feira, 7 de setembro" */
export function formatarDiaPorExtenso(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dataLocalDe(iso));
}

/** "08:00" + "09:00" -> "08:00 às 09:00" */
export function formatarIntervaloHorario(inicio: string, fim: string) {
  return `${inicio} às ${fim}`;
}

/** -1.2 -> "-1,2"; 0.8 -> "+0,8" */
export function formatarVariacao(valor: number, casas = 1) {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}`;
}

/** 95 -> "1:35"; 3725 -> "1:02:05". Para cronômetro e descanso. */
export function formatarCronometro(segundos: number) {
  const total = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;

  const mm = String(minutos).padStart(horas > 0 ? 2 : 1, "0");
  const ss = String(resto).padStart(2, "0");

  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Concorda o substantivo com o número: `plural(1, "treino")` -> "1 treino".
 * Evita o "(s)" que aparecia na interface e as frases que só liam bem no
 * plural ("1 treinos seguidos"). Para os irregulares, passe a forma plural:
 * `plural(2, "avaliação", "avaliações")`.
 */
export function plural(quantidade: number, singular: string, formaPlural?: string) {
  const palavra = quantidade === 1 ? singular : (formaPlural ?? `${singular}s`);
  return `${quantidade} ${palavra}`;
}
