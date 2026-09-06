import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  dataDoInstante,
  dataUTC,
  diaSemanaDeDataUTC,
  intervaloDeDatas,
  paraISO,
  somarDiasUTC,
} from "@/lib/date-utils";
import { ocupaHorario, STATUS_ATIVOS } from "@/lib/agenda/status";
import { notificar } from "@/lib/notificacoes/enviar";
import { REGRAS_PADRAO } from "@/lib/agenda/regras";
import { gerarSlots, removerOcupados, sobrepoe } from "@/lib/agenda/horarios";
import { treinosPrevistosPara } from "@/lib/programacoes/queries";
import type { DiaSemana, StatusAgendamento } from "@/types";
import type {
  AgendaResponse,
  AgendamentoAgenda,
  BloqueioAgenda,
  DiaDaAgenda,
  FaixaDeTrabalho,
  HorariosLivresResponse,
  RegrasAgendamento,
  SlotLivre,
  VistaAgenda,
} from "@/types/agenda";
import type {
  CriarAgendamentoInput,
  CriarBloqueioInput,
  EditarAgendamentoInput,
  FaixaDeTrabalhoInput,
  RegrasAgendamentoInput,
} from "@/lib/validations/agenda";

/**
 * Agenda do Personal autenticado. Todas as consultas filtram por
 * `personalId` - nenhuma agenda de outro profissional entra aqui.
 *
 * As datas do calendário viajam como "AAAA-MM-DD". No banco, `agendamentos.data`
 * é um instante: gravamos sempre a meia-noite local do dia, e a leitura volta
 * pelo mesmo caminho (`dataDoInstante`), então o dia nunca escorrega.
 */

export class AlunoNaoEncontradoError extends Error {
  constructor() {
    super("Aluno não encontrado.");
    this.name = "AlunoNaoEncontradoError";
  }
}

export class AgendamentoNaoEncontradoError extends Error {
  constructor() {
    super("Agendamento não encontrado.");
    this.name = "AgendamentoNaoEncontradoError";
  }
}

export class ConflitoDeHorarioError extends Error {
  constructor(mensagem = "Já existe um atendimento neste horário.") {
    super(mensagem);
    this.name = "ConflitoDeHorarioError";
  }
}

export class HorarioBloqueadoError extends Error {
  constructor() {
    super("Este horário está bloqueado na sua agenda.");
    this.name = "HorarioBloqueadoError";
  }
}

export class PeriodoInvalidoError extends Error {
  constructor(mensagem = "O horário de término precisa ser depois do início.") {
    super(mensagem);
    this.name = "PeriodoInvalidoError";
  }
}

/** Meia-noite local do dia do calendário - é assim que a data é gravada. */
function instanteDoDia(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

/* -------------------------------------------------------------------------
   Horários de trabalho
   ------------------------------------------------------------------------- */

const ORDEM_DIAS: DiaSemana[] = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

function ordenarFaixas(faixas: FaixaDeTrabalho[]): FaixaDeTrabalho[] {
  return [...faixas].sort(
    (a, b) =>
      ORDEM_DIAS.indexOf(a.diaSemana) - ORDEM_DIAS.indexOf(b.diaSemana) ||
      a.horaInicio.localeCompare(b.horaInicio)
  );
}

export async function horariosDeTrabalho(personalId: string): Promise<FaixaDeTrabalho[]> {
  const faixas = await prisma.disponibilidade.findMany({ where: { personalId } });
  return ordenarFaixas(faixas);
}

export async function criarFaixaDeTrabalho(
  personalId: string,
  input: FaixaDeTrabalhoInput
): Promise<FaixaDeTrabalho[]> {
  if (input.horaFim <= input.horaInicio) throw new PeriodoInvalidoError();

  const doDia = await prisma.disponibilidade.findMany({
    where: { personalId, diaSemana: input.diaSemana },
  });

  // Duas faixas que se cruzam gerariam o mesmo horário duas vezes.
  const cruza = doDia.some((faixa) =>
    sobrepoe(input.horaInicio, input.horaFim, faixa.horaInicio, faixa.horaFim)
  );
  if (cruza) {
    throw new ConflitoDeHorarioError("Esta faixa se sobrepõe a outra já cadastrada neste dia.");
  }

  await prisma.disponibilidade.create({
    data: {
      personalId,
      diaSemana: input.diaSemana,
      horaInicio: input.horaInicio,
      horaFim: input.horaFim,
      duracaoMin: input.duracaoMin,
    },
  });

  return horariosDeTrabalho(personalId);
}

export async function removerFaixaDeTrabalho(
  personalId: string,
  faixaId: string
): Promise<FaixaDeTrabalho[] | null> {
  const faixa = await prisma.disponibilidade.findFirst({
    where: { id: faixaId, personalId },
    select: { id: true },
  });
  if (!faixa) return null;

  await prisma.disponibilidade.delete({ where: { id: faixa.id } });
  return horariosDeTrabalho(personalId);
}

/* -------------------------------------------------------------------------
   Bloqueios
   ------------------------------------------------------------------------- */

function toBloqueio(bloqueio: {
  id: string;
  data: Date;
  horaInicio: string | null;
  horaFim: string | null;
  motivo: string | null;
}): BloqueioAgenda {
  return {
    id: bloqueio.id,
    data: paraISO(bloqueio.data),
    horaInicio: bloqueio.horaInicio,
    horaFim: bloqueio.horaFim,
    motivo: bloqueio.motivo,
    diaInteiro: !bloqueio.horaInicio || !bloqueio.horaFim,
  };
}

export async function criarBloqueio(
  personalId: string,
  input: CriarBloqueioInput
): Promise<BloqueioAgenda> {
  const diaInteiro = !input.horaInicio || !input.horaFim;

  if (!diaInteiro && input.horaFim! <= input.horaInicio!) {
    throw new PeriodoInvalidoError();
  }

  const bloqueio = await prisma.bloqueio.create({
    data: {
      personalId,
      data: dataUTC(input.data),
      horaInicio: diaInteiro ? null : input.horaInicio,
      horaFim: diaInteiro ? null : input.horaFim,
      motivo: input.motivo?.trim() || null,
    },
  });

  return toBloqueio(bloqueio);
}

/** "Liberar horário" é apagar o bloqueio. */
export async function removerBloqueio(personalId: string, bloqueioId: string): Promise<boolean> {
  const bloqueio = await prisma.bloqueio.findFirst({
    where: { id: bloqueioId, personalId },
    select: { id: true },
  });
  if (!bloqueio) return false;

  await prisma.bloqueio.delete({ where: { id: bloqueio.id } });
  return true;
}

/* -------------------------------------------------------------------------
   Conflitos
   ------------------------------------------------------------------------- */

const incluirAluno = {
  aluno: { include: { user: { select: { name: true, avatarUrl: true } } } },
} satisfies Prisma.AgendamentoInclude;

type AgendamentoRaw = Prisma.AgendamentoGetPayload<{ include: typeof incluirAluno }>;

function toAgendamento(
  agendamento: AgendamentoRaw,
  treino: { id: string; nome: string } | null
): AgendamentoAgenda {
  return {
    id: agendamento.id,
    data: paraISO(dataDoInstante(agendamento.data)),
    horaInicio: agendamento.horaInicio,
    horaFim: agendamento.horaFim,
    status: agendamento.status,
    observacoes: agendamento.observacoes,
    aluno: {
      id: agendamento.alunoId,
      nome: agendamento.aluno.user.name,
      avatarUrl: agendamento.aluno.user.avatarUrl,
    },
    treino,
  };
}

/**
 * Regra central da agenda: dois alunos nunca ocupam o mesmo horário, e nada é
 * marcado sobre um bloqueio. `ignorarId` existe para o reagendamento não
 * conflitar consigo mesmo.
 */
async function garantirHorarioLivre(
  personalId: string,
  dataISO: string,
  horaInicio: string,
  horaFim: string,
  ignorarId?: string
) {
  if (horaFim <= horaInicio) throw new PeriodoInvalidoError();

  const inicioDoDia = instanteDoDia(dataISO);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setHours(23, 59, 59, 999);

  const [agendamentos, bloqueios] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        personalId,
        data: { gte: inicioDoDia, lte: fimDoDia },
        status: { in: [...STATUS_ATIVOS] },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({
      where: { personalId, data: dataUTC(dataISO) },
      select: { horaInicio: true, horaFim: true },
    }),
  ]);

  const conflito = agendamentos.some((item) =>
    sobrepoe(horaInicio, horaFim, item.horaInicio, item.horaFim)
  );
  if (conflito) throw new ConflitoDeHorarioError();

  const bloqueado = bloqueios.some((item) =>
    !item.horaInicio || !item.horaFim
      ? true
      : sobrepoe(horaInicio, horaFim, item.horaInicio, item.horaFim)
  );
  if (bloqueado) throw new HorarioBloqueadoError();
}

async function nomeDoPersonal(personalId: string) {
  const personal = await prisma.personalProfile.findUnique({
    where: { id: personalId },
    select: { user: { select: { name: true } } },
  });
  return personal?.user.name ?? "Seu Personal";
}

async function garantirAlunoDoPersonal(personalId: string, alunoId: string) {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true },
  });
  if (!aluno) throw new AlunoNaoEncontradoError();
  return aluno;
}

/* -------------------------------------------------------------------------
   Agendamentos
   ------------------------------------------------------------------------- */

export async function criarAgendamento(
  personalId: string,
  input: CriarAgendamentoInput
): Promise<AgendamentoAgenda> {
  await garantirAlunoDoPersonal(personalId, input.alunoId);
  await garantirHorarioLivre(personalId, input.data, input.horaInicio, input.horaFim);

  const agendamento = await prisma.agendamento.create({
    data: {
      personalId,
      alunoId: input.alunoId,
      data: instanteDoDia(input.data),
      horaInicio: input.horaInicio,
      horaFim: input.horaFim,
      status: input.status ?? "CONFIRMADO",
      observacoes: input.observacoes?.trim() || null,
    },
    include: incluirAluno,
  });

  if (ocupaHorario(agendamento.status)) {
    await notificar({
      tipo: "AGENDAMENTO_CONFIRMADO",
      alunoId: agendamento.alunoId,
      quando: {
        data: paraISO(dataDoInstante(agendamento.data)),
        horaInicio: agendamento.horaInicio,
        horaFim: agendamento.horaFim,
      },
    });
  }

  return toAgendamento(agendamento, await treinoDoDia(agendamento));
}

/** Confirmar, cancelar, marcar como realizado ou reagendar. */
export async function atualizarAgendamento(
  personalId: string,
  agendamentoId: string,
  input: EditarAgendamentoInput
): Promise<AgendamentoAgenda> {
  const atual = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, personalId },
  });
  if (!atual) throw new AgendamentoNaoEncontradoError();

  const dataISO = input.data ?? paraISO(dataDoInstante(atual.data));
  const horaInicio = input.horaInicio ?? atual.horaInicio;
  const horaFim = input.horaFim ?? atual.horaFim;

  const mudouHorario =
    dataISO !== paraISO(dataDoInstante(atual.data)) ||
    horaInicio !== atual.horaInicio ||
    horaFim !== atual.horaFim;

  // Um horário cancelado volta a ocupar a agenda ao ser reativado: revalida.
  const voltouAOcupar =
    input.status !== undefined &&
    (STATUS_ATIVOS as readonly StatusAgendamento[]).includes(input.status) &&
    !(STATUS_ATIVOS as readonly StatusAgendamento[]).includes(atual.status);

  if (mudouHorario || voltouAOcupar) {
    await garantirHorarioLivre(personalId, dataISO, horaInicio, horaFim, atual.id);
  }

  const agendamento = await prisma.agendamento.update({
    where: { id: atual.id },
    data: {
      ...(input.data !== undefined ? { data: instanteDoDia(input.data) } : {}),
      ...(input.horaInicio !== undefined ? { horaInicio: input.horaInicio } : {}),
      ...(input.horaFim !== undefined ? { horaFim: input.horaFim } : {}),
      ...(input.observacoes !== undefined
        ? { observacoes: input.observacoes?.trim() || null }
        : {}),
      // Mudar de horário sem dizer o status marca como reagendado.
      ...(input.status !== undefined
        ? { status: input.status }
        : mudouHorario
          ? { status: "REAGENDADO" as const }
          : {}),
    },
    include: incluirAluno,
  });

  const quando = {
    data: paraISO(dataDoInstante(agendamento.data)),
    horaInicio: agendamento.horaInicio,
    horaFim: agendamento.horaFim,
  };

  // Um aviso por mudança: confirmação, cancelamento ou novo horário.
  if (input.status === "CONFIRMADO" && atual.status !== "CONFIRMADO") {
    await notificar({ tipo: "AGENDAMENTO_CONFIRMADO", alunoId: agendamento.alunoId, quando });
  } else if (input.status === "CANCELADO" && atual.status !== "CANCELADO") {
    await notificar({
      tipo: "AGENDAMENTO_CANCELADO",
      alunoId: agendamento.alunoId,
      porQuem: "PERSONAL",
      quem: await nomeDoPersonal(personalId),
      quando,
    });
  } else if (mudouHorario) {
    await notificar({
      tipo: "AGENDAMENTO_REAGENDADO",
      alunoId: agendamento.alunoId,
      porQuem: "PERSONAL",
      quem: await nomeDoPersonal(personalId),
      quando,
    });
  }

  return toAgendamento(agendamento, await treinoDoDia(agendamento));
}

/** O treino que a programação prevê para o aluno na data do agendamento. */
async function treinoDoDia(agendamento: { alunoId: string; data: Date }) {
  const previstos = await treinosPrevistosPara([
    { alunoId: agendamento.alunoId, data: dataDoInstante(agendamento.data) },
  ]);
  const previsto = previstos.get(
    `${agendamento.alunoId}:${paraISO(dataDoInstante(agendamento.data))}`
  );
  return previsto?.treino ? { id: previsto.treino.id, nome: previsto.treino.nome } : null;
}

/* -------------------------------------------------------------------------
   Montagem da agenda
   ------------------------------------------------------------------------- */

/** Início e fim do período conforme a vista escolhida. */
export function periodoDaVista(vista: VistaAgenda, referencia: Date) {
  if (vista === "dia") return { de: referencia, ate: referencia };

  if (vista === "semana") {
    const de = somarDiasUTC(referencia, -referencia.getUTCDay());
    return { de, ate: somarDiasUTC(de, 6) };
  }

  // Mês: da primeira à última semana, para o grid fechar em linhas completas.
  const primeiro = new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1)
  );
  const ultimo = new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 0)
  );
  return {
    de: somarDiasUTC(primeiro, -primeiro.getUTCDay()),
    ate: somarDiasUTC(ultimo, 6 - ultimo.getUTCDay()),
  };
}

export async function agendaDoPeriodo(
  personalId: string,
  vista: VistaAgenda,
  referencia: Date
): Promise<AgendaResponse> {
  const { de, ate } = periodoDaVista(vista, referencia);
  const datas = intervaloDeDatas(de, ate);

  const inicioBusca = instanteDoDia(paraISO(de));
  const fimBusca = instanteDoDia(paraISO(ate));
  fimBusca.setHours(23, 59, 59, 999);

  const [agendamentosRaw, bloqueiosRaw, faixas] = await Promise.all([
    prisma.agendamento.findMany({
      where: { personalId, data: { gte: inicioBusca, lte: fimBusca } },
      include: incluirAluno,
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.bloqueio.findMany({
      where: { personalId, data: { gte: de, lte: ate } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    }),
    horariosDeTrabalho(personalId),
  ]);

  // Um lote só resolve o treino previsto de todos os agendamentos do período.
  const previstos = await treinosPrevistosPara(
    agendamentosRaw.map((item) => ({
      alunoId: item.alunoId,
      data: dataDoInstante(item.data),
    }))
  );

  const porData = new Map<string, AgendamentoAgenda[]>();
  for (const item of agendamentosRaw) {
    const iso = paraISO(dataDoInstante(item.data));
    const previsto = previstos.get(`${item.alunoId}:${iso}`);
    const lista = porData.get(iso) ?? [];
    lista.push(
      toAgendamento(
        item,
        previsto?.treino ? { id: previsto.treino.id, nome: previsto.treino.nome } : null
      )
    );
    porData.set(iso, lista);
  }

  const bloqueiosPorData = new Map<string, BloqueioAgenda[]>();
  for (const bloqueio of bloqueiosRaw) {
    const iso = paraISO(bloqueio.data);
    bloqueiosPorData.set(iso, [...(bloqueiosPorData.get(iso) ?? []), toBloqueio(bloqueio)]);
  }

  const dias: DiaDaAgenda[] = datas.map((data) => {
    const iso = paraISO(data);
    const diaSemana = diaSemanaDeDataUTC(data);
    const agendamentos = porData.get(iso) ?? [];
    const bloqueios = bloqueiosPorData.get(iso) ?? [];
    const doDia = faixas.filter((faixa) => faixa.diaSemana === diaSemana);

    return {
      data: iso,
      diaSemana,
      agendamentos,
      bloqueios,
      // A vista de mês não precisa dos horários livres de cada dia.
      livres: vista === "mes" ? [] : calcularLivres(doDia, agendamentos, bloqueios),
      trabalho: doDia.map((faixa) => ({ horaInicio: faixa.horaInicio, horaFim: faixa.horaFim })),
    };
  });

  const todos = dias.flatMap((dia) => dia.agendamentos);

  return {
    vista,
    referencia: paraISO(referencia),
    de: paraISO(de),
    ate: paraISO(ate),
    dias,
    resumo: {
      agendamentos: todos.filter((item) => item.status !== "CANCELADO").length,
      confirmados: todos.filter((item) => item.status === "CONFIRMADO").length,
      pendentes: todos.filter((item) => item.status === "AGENDADO" || item.status === "REAGENDADO")
        .length,
      realizados: todos.filter((item) => item.status === "REALIZADO").length,
      livres: dias.reduce((total, dia) => total + dia.livres.length, 0),
    },
  };
}

/** Horários de trabalho menos o que já está ocupado ou bloqueado. */
function calcularLivres(
  faixas: FaixaDeTrabalho[],
  agendamentos: AgendamentoAgenda[],
  bloqueios: BloqueioAgenda[]
): SlotLivre[] {
  if (faixas.length === 0) return [];
  if (bloqueios.some((bloqueio) => bloqueio.diaInteiro)) return [];

  const ocupados = [
    ...agendamentos
      .filter((item) => item.status !== "CANCELADO")
      .map((item) => ({ horaInicio: item.horaInicio, horaFim: item.horaFim })),
    ...bloqueios
      .filter((item) => !item.diaInteiro)
      .map((item) => ({ horaInicio: item.horaInicio!, horaFim: item.horaFim! })),
  ];

  const slots = faixas.flatMap((faixa) =>
    gerarSlots(faixa.horaInicio, faixa.horaFim, faixa.duracaoMin)
  );

  return removerOcupados(slots, ocupados).sort((a, b) =>
    a.horaInicio.localeCompare(b.horaInicio)
  );
}

/** Horários livres de um dia - alimenta o seletor de novo agendamento. */
export async function horariosLivres(
  personalId: string,
  dataISO: string
): Promise<HorariosLivresResponse> {
  const data = dataUTC(dataISO);
  const diaSemana = diaSemanaDeDataUTC(data);

  const inicioDoDia = instanteDoDia(dataISO);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setHours(23, 59, 59, 999);

  const [faixas, agendamentosRaw, bloqueiosRaw] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { personalId, diaSemana } }),
    prisma.agendamento.findMany({
      where: {
        personalId,
        data: { gte: inicioDoDia, lte: fimDoDia },
        status: { in: [...STATUS_ATIVOS] },
      },
      select: { horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({ where: { personalId, data } }),
  ]);

  const bloqueios = bloqueiosRaw.map(toBloqueio);

  if (faixas.length === 0) {
    return { data: dataISO, diaSemana, livres: [], motivo: "SEM_TRABALHO" };
  }
  if (bloqueios.some((bloqueio) => bloqueio.diaInteiro)) {
    return { data: dataISO, diaSemana, livres: [], motivo: "BLOQUEADO" };
  }

  const ocupados = [
    ...agendamentosRaw,
    ...bloqueios
      .filter((item) => !item.diaInteiro)
      .map((item) => ({ horaInicio: item.horaInicio!, horaFim: item.horaFim! })),
  ];

  const livres = removerOcupados(
    faixas.flatMap((faixa) => gerarSlots(faixa.horaInicio, faixa.horaFim, faixa.duracaoMin)),
    ocupados
  ).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  return {
    data: dataISO,
    diaSemana,
    livres,
    motivo: livres.length === 0 ? "LOTADO" : "OK",
  };
}

/* -------------------------------------------------------------------------
   Regras de agendamento
   ------------------------------------------------------------------------- */

/** Regras do Personal; sem configuração salva, valem os padrões. */
export async function regrasDoPersonal(personalId: string): Promise<RegrasAgendamento> {
  const config = await prisma.configuracaoAgenda.findUnique({ where: { personalId } });
  if (!config) return REGRAS_PADRAO;

  return {
    permiteAgendamento: config.permiteAgendamento,
    antecedenciaMinHoras: config.antecedenciaMinHoras,
    janelaDias: config.janelaDias,
    cancelamentoMinHoras: config.cancelamentoMinHoras,
    maxAtivosPorAluno: config.maxAtivosPorAluno,
    confirmacaoAutomatica: config.confirmacaoAutomatica,
    duracaoPadraoMin: config.duracaoPadraoMin,
  };
}

export async function salvarRegras(
  personalId: string,
  input: RegrasAgendamentoInput
): Promise<RegrasAgendamento> {
  const atuais = await regrasDoPersonal(personalId);
  const novas = { ...atuais, ...input };

  await prisma.configuracaoAgenda.upsert({
    where: { personalId },
    create: { personalId, ...novas },
    update: novas,
  });

  return novas;
}
