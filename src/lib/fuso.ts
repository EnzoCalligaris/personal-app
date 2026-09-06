/**
 * O fuso da aplicação.
 *
 * A plataforma atende no Brasil: quando o Personal escreve "07:00" na agenda,
 * são sete da manhã em São Paulo - não no fuso em que o servidor por acaso
 * está rodando. Sem fixar isso, o mesmo código se comporta diferente na
 * máquina do desenvolvedor (UTC-3) e no contêiner de produção (UTC): o dia
 * "de hoje" vira o de amanhã às 21:00 e todo atendimento é lido três horas
 * antes do que é.
 *
 * Regras deste módulo:
 *
 * - **Data de calendário** ("2026-09-08") é um dia no calendário, sem hora.
 *   Trafega como texto `YYYY-MM-DD`, é guardada em coluna `date` e, quando
 *   precisa virar `Date`, usa meia-noite UTC como âncora - assim a leitura
 *   nunca escorrega de dia.
 * - **Instante** é um ponto no tempo (quando o treino foi executado, quando o
 *   feedback foi escrito). Guardado como timestamp e comparado com `Date.now()`.
 * - A ponte entre os dois - "que instante é 07:00 do dia 08?" - passa
 *   obrigatoriamente por aqui, nunca pelo fuso do processo.
 */

export const FUSO_APP = "America/Sao_Paulo";

const FORMATADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_APP,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type ParedeNoFuso = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

/** Como o relógio de parede em São Paulo lê este instante. */
function paredeDe(instante: Date): ParedeNoFuso {
  const partes = FORMATADOR.formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);

  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    // `hour12: false` pode devolver 24 na virada; 24:10 é 00:10.
    hora: valor("hour") % 24,
    minuto: valor("minute"),
    segundo: valor("second"),
  };
}

/** Quanto o fuso está deslocado de UTC neste instante, em milissegundos. */
function deslocamento(instante: Date): number {
  const p = paredeDe(instante);
  const comoSeFosseUTC = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  // Zera os milissegundos dos dois lados antes de comparar.
  return comoSeFosseUTC - Math.floor(instante.getTime() / 1000) * 1000;
}

/**
 * O instante real de um horário de parede em São Paulo.
 * `instanteDeParede("2026-09-08", "07:00")` -> 2026-09-08T10:00:00Z.
 *
 * Duas passagens porque o deslocamento depende do próprio instante: o
 * primeiro chute pode cair do lado errado de uma mudança de horário. O Brasil
 * não usa horário de verão desde 2019, mas a conta certa não custa nada.
 */
export function instanteDeParede(dataISO: string, hora = "00:00"): Date {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);

  const chute = Date.UTC(ano, mes - 1, dia, h, m, 0, 0);
  const primeiro = new Date(chute - deslocamento(new Date(chute)));
  return new Date(chute - deslocamento(primeiro));
}

/** A data de calendário (em São Paulo) em que este instante cai. */
export function dataDeCalendarioDe(instante: Date): string {
  const p = paredeDe(instante);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/** O dia de hoje no calendário brasileiro, como texto `YYYY-MM-DD`. */
export function hojeISO(agora: Date = new Date()): string {
  return dataDeCalendarioDe(agora);
}

/**
 * Começo e fim de um dia do calendário, como instantes reais - para filtrar
 * colunas que guardam instante (ex.: `historico_treinos.dataExecucao`).
 */
export function limitesDoDia(dataISO: string): { de: Date; ate: Date } {
  return {
    de: instanteDeParede(dataISO, "00:00"),
    ate: new Date(instanteDeParede(dataISO, "23:59").getTime() + 59_999),
  };
}

/** A hora de parede em São Paulo neste instante, como "HH:MM". */
export function horaDeParede(instante: Date = new Date()): string {
  const p = paredeDe(instante);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}
