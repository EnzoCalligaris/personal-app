import { dataDeCalendarioDe, FUSO_APP } from "@/lib/fuso";
import type { DiaSemana } from "@/types";

const DATA_DE_CALENDARIO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A API devolve datas em duas formas, e cada uma se exibe de um jeito:
 *
 * - **Data de calendário** ("2026-09-08") é um dia, não um ponto no tempo.
 *   Ancorada e lida em UTC, sai igual em qualquer lugar do mundo. Fazer
 *   `new Date("2026-09-08")` e formatar no fuso local mostraria o dia 07 no
 *   Brasil, porque meia-noite UTC é 21:00 do dia anterior aqui.
 * - **Instante** ("2026-09-08T10:00:00.000Z") é exibido no fuso da aplicação,
 *   não no do navegador: o horário que o Personal vê tem que ser o mesmo que
 *   o aluno vê, mesmo que um dos dois esteja viajando.
 */
function paraExibicao(iso: string): { instante: Date; timeZone: string } {
  const texto = iso.trim();

  if (DATA_DE_CALENDARIO.test(texto)) {
    const [ano, mes, dia] = texto.split("-").map(Number);
    return { instante: new Date(Date.UTC(ano, mes - 1, dia)), timeZone: "UTC" };
  }

  return { instante: new Date(texto), timeZone: FUSO_APP };
}

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
  const { instante, timeZone } = paraExibicao(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(instante);
}

export function formatarDataCompleta(iso: string) {
  const { instante, timeZone } = paraExibicao(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone,
  }).format(instante);
}

/** "hoje", "ontem", "há 3 dias" ou a data, para períodos maiores. */
export function formatarDataRelativa(iso: string, referencia = new Date()) {
  const umDia = 24 * 60 * 60 * 1000;
  // Compara dias do calendário brasileiro, não instantes: às 22h de domingo,
  // "hoje" ainda é domingo.
  const emDias = (texto: string) => {
    const [ano, mes, dia] = texto.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  const diaDaData = DATA_DE_CALENDARIO.test(iso.trim())
    ? iso.trim()
    : dataDeCalendarioDe(new Date(iso));
  const dias = Math.round((emDias(dataDeCalendarioDe(referencia)) - emDias(diaDaData)) / umDia);

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

/** "2026-09-07" -> "07 de set." */
export function formatarDataCalendario(iso: string) {
  const { instante, timeZone } = paraExibicao(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone }).format(
    instante
  );
}

/** "2026-09-07" -> "segunda-feira, 7 de setembro" */
export function formatarDiaPorExtenso(iso: string) {
  const { instante, timeZone } = paraExibicao(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(instante);
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
