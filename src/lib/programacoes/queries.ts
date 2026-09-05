import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DIAS_SEMANA,
  dataUTC,
  diaSemanaDeDataUTC,
  hojeUTC,
  intervaloDeDatas,
  paraISO,
} from "@/lib/date-utils";
import type { DiaSemana } from "@/types";
import type {
  CalendarioResponse,
  DiaPrevisto,
  Programacao,
  ProgramacaoListResponse,
  ProgramacaoTreinoResumo,
} from "@/types/programacao";
import type {
  CriarProgramacaoInput,
  EditarProgramacaoInput,
} from "@/lib/validations/programacao";

export class AlunoNaoEncontradoError extends Error {
  constructor() {
    super("Aluno não encontrado.");
    this.name = "AlunoNaoEncontradoError";
  }
}

export class TreinoInvalidoError extends Error {
  constructor(mensagem = "Treino não encontrado para este aluno.") {
    super(mensagem);
    this.name = "TreinoInvalidoError";
  }
}

export class PeriodoInvalidoError extends Error {
  constructor() {
    super("A data de término não pode ser anterior à data de início.");
    this.name = "PeriodoInvalidoError";
  }
}

async function garantirAlunoDoPersonal(personalId: string, alunoId: string) {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true },
  });
  if (!aluno) throw new AlunoNaoEncontradoError();
  return aluno;
}

/**
 * O treino precisa ser deste Personal E deste aluno: a ficha de um aluno não
 * pode ser prescrita para outro.
 */
async function garantirTreinoDoAluno(personalId: string, alunoId: string, treinoId: string) {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId, alunoId },
    select: { id: true },
  });
  if (!treino) throw new TreinoInvalidoError();
  return treino;
}

const includeProgramacao = {
  dias: {
    include: {
      treino: {
        select: {
          id: true,
          nome: true,
          ativo: true,
          _count: { select: { exercicios: true } },
          exercicios: { select: { exercicio: { select: { grupoMuscular: true } } } },
        },
      },
    },
  },
} satisfies Prisma.ProgramacaoInclude;

type ProgramacaoRaw = Prisma.ProgramacaoGetPayload<{ include: typeof includeProgramacao }>;
type TreinoRaw = ProgramacaoRaw["dias"][number]["treino"];

function toResumoTreino(treino: TreinoRaw): ProgramacaoTreinoResumo {
  return {
    id: treino.id,
    nome: treino.nome,
    ativo: treino.ativo,
    totalExercicios: treino._count.exercicios,
    grupos: [...new Set(treino.exercicios.map((item) => item.exercicio.grupoMuscular))],
  };
}

function toProgramacao(programacao: ProgramacaoRaw, hoje = hojeUTC()): Programacao {
  const porDia = new Map(programacao.dias.map((dia) => [dia.diaSemana, dia]));

  const inicio = programacao.dataInicio;
  const fim = programacao.dataFim;

  return {
    id: programacao.id,
    nome: programacao.nome,
    dataInicio: paraISO(inicio),
    dataFim: fim ? paraISO(fim) : null,
    observacoes: programacao.observacoes,
    dias: DIAS_SEMANA.map((diaSemana) => {
      const item = porDia.get(diaSemana);
      return { diaSemana, treino: item ? toResumoTreino(item.treino) : null };
    }),
    vigente: inicio <= hoje && (!fim || fim >= hoje),
    encerrada: !!fim && fim < hoje,
    criadaEm: programacao.createdAt.toISOString(),
  };
}

/** Programações do aluno, da mais recente para a mais antiga. */
export async function listarProgramacoes(
  personalId: string,
  alunoId: string
): Promise<ProgramacaoListResponse> {
  await garantirAlunoDoPersonal(personalId, alunoId);

  const programacoes = await prisma.programacao.findMany({
    where: { personalId, alunoId },
    include: includeProgramacao,
    orderBy: { dataInicio: "desc" },
  });

  const hoje = hojeUTC();
  const mapeadas = programacoes.map((programacao) => toProgramacao(programacao, hoje));

  return {
    programacoes: mapeadas,
    vigente: mapeadas.find((programacao) => programacao.vigente) ?? null,
  };
}

export async function obterProgramacao(
  personalId: string,
  programacaoId: string
): Promise<Programacao | null> {
  const programacao = await prisma.programacao.findFirst({
    where: { id: programacaoId, personalId },
    include: includeProgramacao,
  });

  return programacao ? toProgramacao(programacao) : null;
}

/**
 * Cria uma programação para o aluno. Se já houver outra em aberto que alcança
 * a nova data de início, ela é encerrada na véspera - assim a linha do tempo
 * não fica com duas rotinas valendo ao mesmo tempo.
 */
export async function criarProgramacao(
  personalId: string,
  input: CriarProgramacaoInput
): Promise<Programacao> {
  await garantirAlunoDoPersonal(personalId, input.alunoId);

  const dataInicio = dataUTC(input.dataInicio);
  const dataFim = input.dataFim ? dataUTC(input.dataFim) : null;

  if (dataFim && dataFim < dataInicio) throw new PeriodoInvalidoError();

  for (const dia of input.dias ?? []) {
    await garantirTreinoDoAluno(personalId, input.alunoId, dia.treinoId);
  }

  const criada = await prisma.$transaction(async (tx) => {
    const vespera = new Date(dataInicio);
    vespera.setUTCDate(vespera.getUTCDate() - 1);

    await tx.programacao.updateMany({
      where: {
        personalId,
        alunoId: input.alunoId,
        OR: [{ dataFim: null }, { dataFim: { gte: dataInicio } }],
      },
      data: { dataFim: vespera },
    });

    return tx.programacao.create({
      data: {
        personalId,
        alunoId: input.alunoId,
        nome: input.nome || null,
        dataInicio,
        dataFim,
        observacoes: input.observacoes || null,
        dias: {
          create: (input.dias ?? []).map((dia) => ({
            diaSemana: dia.diaSemana,
            treinoId: dia.treinoId,
          })),
        },
      },
      include: includeProgramacao,
    });
  });

  return toProgramacao(criada);
}

export async function atualizarProgramacao(
  personalId: string,
  programacaoId: string,
  input: EditarProgramacaoInput
): Promise<Programacao | null> {
  const atual = await prisma.programacao.findFirst({
    where: { id: programacaoId, personalId },
    select: { id: true, dataInicio: true, dataFim: true },
  });
  if (!atual) return null;

  const dataInicio = input.dataInicio ? dataUTC(input.dataInicio) : atual.dataInicio;
  const dataFim =
    input.dataFim === undefined ? atual.dataFim : input.dataFim ? dataUTC(input.dataFim) : null;

  if (dataFim && dataFim < dataInicio) throw new PeriodoInvalidoError();

  await prisma.programacao.update({
    where: { id: atual.id },
    data: {
      ...(input.nome !== undefined ? { nome: input.nome || null } : {}),
      ...(input.observacoes !== undefined ? { observacoes: input.observacoes || null } : {}),
      ...(input.dataInicio !== undefined ? { dataInicio } : {}),
      ...(input.dataFim !== undefined ? { dataFim } : {}),
    },
  });

  return obterProgramacao(personalId, atual.id);
}

export async function excluirProgramacao(
  personalId: string,
  programacaoId: string
): Promise<"excluida" | "nao_encontrada"> {
  const programacao = await prisma.programacao.findFirst({
    where: { id: programacaoId, personalId },
    select: { id: true },
  });
  if (!programacao) return "nao_encontrada";

  await prisma.programacao.delete({ where: { id: programacao.id } });
  return "excluida";
}

/** Define (ou troca) o treino de um dia da semana. */
export async function definirDia(
  personalId: string,
  programacaoId: string,
  diaSemana: DiaSemana,
  treinoId: string
): Promise<Programacao | null> {
  const programacao = await prisma.programacao.findFirst({
    where: { id: programacaoId, personalId },
    select: { id: true, alunoId: true },
  });
  if (!programacao) return null;

  await garantirTreinoDoAluno(personalId, programacao.alunoId, treinoId);

  await prisma.programacaoDia.upsert({
    where: { programacaoId_diaSemana: { programacaoId: programacao.id, diaSemana } },
    create: { programacaoId: programacao.id, diaSemana, treinoId },
    update: { treinoId },
  });

  return obterProgramacao(personalId, programacao.id);
}

/** Remove o treino do dia - o dia vira descanso. */
export async function removerDia(
  personalId: string,
  programacaoId: string,
  diaSemana: DiaSemana
): Promise<Programacao | null> {
  const programacao = await prisma.programacao.findFirst({
    where: { id: programacaoId, personalId },
    select: { id: true },
  });
  if (!programacao) return null;

  await prisma.programacaoDia.deleteMany({
    where: { programacaoId: programacao.id, diaSemana },
  });

  return obterProgramacao(personalId, programacao.id);
}

/* -------------------------------------------------------------------------
   Resolução: o que está previsto em uma data
   ------------------------------------------------------------------------- */

type ProgramacaoParaResolver = ProgramacaoRaw;

/**
 * Entre programações que cobrem a data, vale a que começou mais tarde. Isso
 * faz uma rotina nova substituir a anterior mesmo que a antiga tenha ficado
 * com um período mais longo.
 */
function programacaoDaData(programacoes: ProgramacaoParaResolver[], data: Date) {
  return (
    programacoes
      .filter((p) => p.dataInicio <= data && (!p.dataFim || p.dataFim >= data))
      .sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime())[0] ?? null
  );
}

function montarDiaPrevisto(
  data: Date,
  programacao: ProgramacaoParaResolver | null,
  executadoEm: Set<string>
): DiaPrevisto {
  const diaSemana = diaSemanaDeDataUTC(data);
  const iso = paraISO(data);
  const executado = executadoEm.has(iso);

  if (!programacao) {
    return {
      data: iso,
      diaSemana,
      tipo: "SEM_PROGRAMACAO",
      treino: null,
      treinoInativo: false,
      programacao: null,
      executado,
    };
  }

  const item = programacao.dias.find((dia) => dia.diaSemana === diaSemana);
  const resumoProgramacao = { id: programacao.id, nome: programacao.nome };

  if (!item) {
    return {
      data: iso,
      diaSemana,
      tipo: "DESCANSO",
      treino: null,
      treinoInativo: false,
      programacao: resumoProgramacao,
      executado,
    };
  }

  return {
    data: iso,
    diaSemana,
    tipo: "TREINO",
    treino: toResumoTreino(item.treino),
    treinoInativo: !item.treino.ativo,
    programacao: resumoProgramacao,
    executado,
  };
}

/** Datas (YYYY-MM-DD) em que houve execução registrada no intervalo. */
async function execucoesNoPeriodo(alunoId: string, de: Date, ate: Date) {
  const fimDoDia = new Date(ate);
  fimDoDia.setUTCHours(23, 59, 59, 999);

  const historico = await prisma.historicoTreino.findMany({
    where: { alunoId, dataExecucao: { gte: de, lte: fimDoDia } },
    select: { dataExecucao: true },
  });

  return new Set(historico.map((item) => paraISO(item.dataExecucao)));
}

/** O que o aluno deve treinar em uma data específica. */
export async function treinoPrevistoEm(alunoId: string, data: Date): Promise<DiaPrevisto> {
  const programacoes = await prisma.programacao.findMany({
    where: {
      alunoId,
      dataInicio: { lte: data },
      OR: [{ dataFim: null }, { dataFim: { gte: data } }],
    },
    include: includeProgramacao,
    orderBy: { dataInicio: "desc" },
  });

  const executadoEm = await execucoesNoPeriodo(alunoId, data, data);
  return montarDiaPrevisto(data, programacaoDaData(programacoes, data), executadoEm);
}

/** Calendário do período: uma linha por data, com o previsto de cada dia. */
export async function calendarioDoAluno(
  personalId: string,
  alunoId: string,
  de: Date,
  ate: Date
): Promise<CalendarioResponse> {
  await garantirAlunoDoPersonal(personalId, alunoId);

  // Uma consulta só para todo o intervalo: as programações que o alcançam.
  const programacoes = await prisma.programacao.findMany({
    where: {
      alunoId,
      dataInicio: { lte: ate },
      OR: [{ dataFim: null }, { dataFim: { gte: de } }],
    },
    include: includeProgramacao,
  });

  const executadoEm = await execucoesNoPeriodo(alunoId, de, ate);

  return {
    de: paraISO(de),
    ate: paraISO(ate),
    dias: intervaloDeDatas(de, ate).map((data) =>
      montarDiaPrevisto(data, programacaoDaData(programacoes, data), executadoEm)
    ),
  };
}

/**
 * Próximo dia com treino a partir de uma data (inclusive), olhando uma
 * semana à frente - para vários alunos de uma vez, em uma única consulta.
 * Usado nas listagens ("próximo treino" do aluno).
 */
export async function proximosTreinosDeAlunos(
  alunoIds: string[],
  aPartirDe: Date = hojeUTC()
): Promise<Map<string, DiaPrevisto>> {
  const resultado = new Map<string, DiaPrevisto>();
  if (alunoIds.length === 0) return resultado;

  const fim = new Date(aPartirDe);
  fim.setUTCDate(fim.getUTCDate() + 6);

  const programacoes = await prisma.programacao.findMany({
    where: {
      alunoId: { in: alunoIds },
      dataInicio: { lte: fim },
      OR: [{ dataFim: null }, { dataFim: { gte: aPartirDe } }],
    },
    include: includeProgramacao,
  });

  const porAluno = new Map<string, ProgramacaoParaResolver[]>();
  for (const programacao of programacoes) {
    const lista = porAluno.get(programacao.alunoId) ?? [];
    lista.push(programacao);
    porAluno.set(programacao.alunoId, lista);
  }

  const datas = intervaloDeDatas(aPartirDe, fim);
  const semExecucoes = new Set<string>();

  for (const alunoId of alunoIds) {
    const doAluno = porAluno.get(alunoId) ?? [];
    for (const data of datas) {
      const previsto = montarDiaPrevisto(data, programacaoDaData(doAluno, data), semExecucoes);
      if (previsto.tipo === "TREINO") {
        resultado.set(alunoId, previsto);
        break;
      }
    }
  }

  return resultado;
}

/** Atalho para um aluno só. */
export async function proximoTreinoDoAluno(
  alunoId: string,
  aPartirDe: Date = hojeUTC()
): Promise<DiaPrevisto | null> {
  const mapa = await proximosTreinosDeAlunos([alunoId], aPartirDe);
  return mapa.get(alunoId) ?? null;
}

/**
 * Resolve o previsto para vários pares (aluno, data) de uma vez. Usado, por
 * exemplo, para descobrir o treino de cada agendamento da agenda.
 * A chave do mapa é `alunoId:AAAA-MM-DD`.
 */
export async function treinosPrevistosPara(
  pares: { alunoId: string; data: Date }[]
): Promise<Map<string, DiaPrevisto>> {
  const resultado = new Map<string, DiaPrevisto>();
  if (pares.length === 0) return resultado;

  const alunoIds = [...new Set(pares.map((par) => par.alunoId))];
  const datas = pares.map((par) => par.data.getTime());
  const menorData = new Date(Math.min(...datas));
  const maiorData = new Date(Math.max(...datas));

  const programacoes = await prisma.programacao.findMany({
    where: {
      alunoId: { in: alunoIds },
      dataInicio: { lte: maiorData },
      OR: [{ dataFim: null }, { dataFim: { gte: menorData } }],
    },
    include: includeProgramacao,
  });

  const porAluno = new Map<string, ProgramacaoParaResolver[]>();
  for (const programacao of programacoes) {
    const lista = porAluno.get(programacao.alunoId) ?? [];
    lista.push(programacao);
    porAluno.set(programacao.alunoId, lista);
  }

  const semExecucoes = new Set<string>();

  for (const par of pares) {
    const doAluno = porAluno.get(par.alunoId) ?? [];
    resultado.set(
      `${par.alunoId}:${paraISO(par.data)}`,
      montarDiaPrevisto(par.data, programacaoDaData(doAluno, par.data), semExecucoes)
    );
  }

  return resultado;
}

/** Quantos treinos estão prescritos hoje entre todos os alunos do Personal. */
export async function treinosPrevistosHoje(personalId: string, hoje: Date = hojeUTC()) {
  return prisma.programacaoDia.count({
    where: {
      diaSemana: diaSemanaDeDataUTC(hoje),
      treino: { ativo: true },
      programacao: {
        personalId,
        dataInicio: { lte: hoje },
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
    },
  });
}
