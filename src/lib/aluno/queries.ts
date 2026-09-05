import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { STATUS_ATIVOS } from "@/lib/agenda/status";
import { regrasDoPersonal } from "@/lib/agenda/queries";
import { instanteDoAtendimento, podeDesmarcar, REGRAS_PADRAO } from "@/lib/agenda/regras";
import {
  dataDoInstante,
  hojeUTC,
  limitesDoDiaLocal,
  paraISO,
  somarDiasUTC,
  intervaloDeDatas,
} from "@/lib/date-utils";
import { duracaoEstimadaMin } from "@/lib/treinos/duracao";
import { incluirDiasProgramados, ordenarDias } from "@/lib/treinos/queries";
import { proximoTreinoDoAluno, treinoPrevistoEm, treinosPrevistosPara } from "@/lib/programacoes/queries";
import type {
  EditarMeuPerfilInput,
  RegistrarExecucaoInput,
} from "@/lib/validations/aluno-area";
import type {
  AlunoDashboardResponse,
  DiaDeTreino,
  ExecucaoRegistrada,
  MeuAgendamento,
  MeuFeedback,
  MeuPerfil,
  MeuPersonal,
  MeuTreino,
  MeuHistoricoResponse,
  MeuTreinoDetalhe,
  MeusTreinosResponse,
  MinhaAgendaResponse,
  MinhaAvaliacao,
  MinhaEvolucaoResponse,
  VariacaoMetrica,
} from "@/types/aluno-area";
import type { RegrasAgendamento } from "@/types/agenda";
import type { TreinoItemExercicio } from "@/types/treino";

/**
 * Tudo neste módulo recebe o `alunoId` do **perfil autenticado** (resolvido
 * pela sessão em `requireAluno`), nunca um id vindo do cliente. Consultas por
 * id de outro recurso (um treino, por exemplo) sempre carregam `alunoId` no
 * `where`, então um id de outro aluno simplesmente não encontra nada.
 */

export class TreinoNaoEncontradoError extends Error {
  constructor() {
    super("Treino não encontrado.");
    this.name = "TreinoNaoEncontradoError";
  }
}

export class ItemInvalidoError extends Error {
  constructor() {
    super("Um dos exercícios enviados não faz parte deste treino.");
    this.name = "ItemInvalidoError";
  }
}

/** Últimos dias considerados ao calcular a sequência de treinos. */
const JANELA_SEQUENCIA_DIAS = 30;


function includeTreinoCom(hoje: Date) {
  return {
    exercicios: {
      select: {
        series: true,
        descansoSeg: true,
        exercicio: { select: { grupoMuscular: true } },
      },
      orderBy: { ordem: "asc" },
    },
    historico: { select: { dataExecucao: true }, orderBy: { dataExecucao: "desc" }, take: 1 },
    diasProgramados: incluirDiasProgramados(hoje),
    _count: { select: { exercicios: true, historico: true } },
  } satisfies Prisma.TreinoInclude;
}

type TreinoRaw = Prisma.TreinoGetPayload<{ include: ReturnType<typeof includeTreinoCom> }>;

function toMeuTreino(treino: TreinoRaw): MeuTreino {
  return {
    id: treino.id,
    nome: treino.nome,
    observacoes: treino.observacoes,
    ativo: treino.ativo,
    totalExercicios: treino._count.exercicios,
    grupos: [...new Set(treino.exercicios.map((item) => item.exercicio.grupoMuscular))],
    duracaoMin: duracaoEstimadaMin(treino.exercicios),
    diasProgramados: ordenarDias(treino.diasProgramados),
    ultimaExecucao: treino.historico[0]?.dataExecucao.toISOString() ?? null,
    totalExecucoes: treino._count.historico,
  };
}

function toPersonal(
  personal: { user: { name: string; email: string; avatarUrl: string | null } } | null
): MeuPersonal | null {
  if (!personal) return null;
  return {
    nome: personal.user.name,
    email: personal.user.email,
    avatarUrl: personal.user.avatarUrl,
  };
}

function toAgendamento(
  item: {
    id: string;
    data: Date;
    horaInicio: string;
    horaFim: string;
    status: MeuAgendamento["status"];
    observacoes: string | null;
  },
  regras: RegrasAgendamento = REGRAS_PADRAO,
  agora: Date = new Date()
): MeuAgendamento {
  const ativo = (STATUS_ATIVOS as readonly string[]).includes(item.status);
  const inicio = instanteDoAtendimento(paraISO(dataDoInstante(item.data)), item.horaInicio);

  return {
    id: item.id,
    data: item.data.toISOString(),
    horaInicio: item.horaInicio,
    horaFim: item.horaFim,
    status: item.status,
    observacoes: item.observacoes,
    podeDesmarcar: ativo && podeDesmarcar(inicio, regras, agora),
  };
}

/* -------------------------------------------------------------------------
   Treinos
   ------------------------------------------------------------------------- */

export async function meusTreinos(alunoId: string): Promise<MeusTreinosResponse> {
  const hoje = hojeUTC();

  const [treinos, historico] = await Promise.all([
    prisma.treino.findMany({
      where: { alunoId, ativo: true },
      include: includeTreinoCom(hoje),
      orderBy: { createdAt: "asc" },
    }),
    prisma.historicoTreino.findMany({
      where: { alunoId },
      include: includeExecucao,
      orderBy: { dataExecucao: "desc" },
      take: 5,
    }),
  ]);

  return {
    treinos: treinos.map(toMeuTreino),
    historico: historico.map(toExecucao),
  };
}

export async function meuTreino(
  alunoId: string,
  treinoId: string
): Promise<MeuTreinoDetalhe | null> {
  const hoje = hojeUTC();

  // O `alunoId` no where é o que impede abrir a ficha de outro aluno: um id
  // que não seja dele responde "não encontrado".
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, alunoId },
    include: {
      ...includeTreinoCom(hoje),
      exercicios: {
        include: {
          exercicio: {
            select: {
              id: true,
              nome: true,
              grupoMuscular: true,
              imagemUrl: true,
              videoUrl: true,
              ativo: true,
            },
          },
        },
        orderBy: { ordem: "asc" },
      },
    },
  });

  if (!treino) return null;

  const exercicios: TreinoItemExercicio[] = treino.exercicios.map((item) => ({
    id: item.id,
    ordem: item.ordem,
    series: item.series,
    repeticoes: item.repeticoes,
    carga: item.carga,
    descansoSeg: item.descansoSeg,
    observacoes: item.observacoes,
    exercicio: item.exercicio,
  }));

  return {
    ...toMeuTreino(treino),
    exercicios,
  };
}

/* -------------------------------------------------------------------------
   Execução e histórico
   ------------------------------------------------------------------------- */

const includeExecucao = {
  treino: { select: { id: true, nome: true } },
  itens: { orderBy: { ordem: "asc" } },
} satisfies Prisma.HistoricoTreinoInclude;

type ExecucaoRaw = Prisma.HistoricoTreinoGetPayload<{ include: typeof includeExecucao }>;

function toExecucao(execucao: ExecucaoRaw): ExecucaoRegistrada {
  const itens = execucao.itens.map((item) => ({
    id: item.id,
    ordem: item.ordem,
    nome: item.nome,
    grupoMuscular: item.grupoMuscular,
    series: item.series,
    repeticoes: item.repeticoes,
    carga: item.carga,
    concluido: item.concluido,
    observacoes: item.observacoes,
  }));

  const concluidos = itens.filter((item) => item.concluido);

  return {
    id: execucao.id,
    data: execucao.dataExecucao.toISOString(),
    concluido: execucao.concluido,
    observacoes: execucao.observacoes,
    duracaoSeg: execucao.duracaoSeg,
    treino: execucao.treino,
    itens,
    exerciciosConcluidos: concluidos.length,
    totalExercicios: itens.length,
    totalSeries: concluidos.reduce((total, item) => total + item.series, 0),
  };
}

/**
 * Registra a execução do treino pelo próprio aluno.
 *
 * Os itens gravados são um retrato do momento: nome e grupo muscular vêm da
 * ficha (o cliente não decide o que ficou registrado), enquanto séries,
 * repetições e carga aceitam o que o aluno realmente fez - caindo para o
 * prescrito quando ele não ajusta nada. Sem `itens`, a ficha inteira é
 * registrada como feita.
 */
export async function registrarExecucao(
  alunoId: string,
  treinoId: string,
  input: RegistrarExecucaoInput
): Promise<ExecucaoRegistrada> {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, alunoId },
    include: {
      exercicios: {
        orderBy: { ordem: "asc" },
        include: { exercicio: { select: { id: true, nome: true, grupoMuscular: true } } },
      },
    },
  });
  if (!treino) throw new TreinoNaoEncontradoError();

  const prescritos = new Map(treino.exercicios.map((item) => [item.id, item]));

  for (const item of input.itens ?? []) {
    // Um id que não é deste treino não vira registro silencioso.
    if (!prescritos.has(item.treinoExercicioId)) throw new ItemInvalidoError();
  }

  const realizados = input.itens?.length
    ? input.itens.map((item) => ({ prescrito: prescritos.get(item.treinoExercicioId)!, item }))
    : treino.exercicios.map((prescrito) => ({ prescrito, item: undefined }));

  const execucao = await prisma.historicoTreino.create({
    data: {
      treinoId: treino.id,
      alunoId,
      concluido: input.concluido ?? true,
      observacoes: input.observacoes?.trim() || null,
      duracaoSeg: input.duracaoSeg ?? null,
      itens: {
        create: realizados.map(({ prescrito, item }, indice) => ({
          exercicioId: prescrito.exercicio.id,
          // A ordem vem da posição enviada: é a ordem em que o aluno treinou.
          ordem: indice + 1,
          nome: prescrito.exercicio.nome,
          grupoMuscular: prescrito.exercicio.grupoMuscular,
          series: item?.series ?? prescrito.series,
          repeticoes: item?.repeticoes?.trim() || prescrito.repeticoes,
          carga: item?.carga?.trim() ?? prescrito.carga,
          concluido: item?.concluido ?? true,
          observacoes: item?.observacoes?.trim() || null,
        })),
      },
    },
    include: includeExecucao,
  });

  return toExecucao(execucao);
}

/** Histórico completo de execuções do aluno, com o que foi feito em cada uma. */
export async function meuHistorico(alunoId: string, limite = 50): Promise<MeuHistoricoResponse> {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const [execucoes, total, noMes, duracoes] = await Promise.all([
    prisma.historicoTreino.findMany({
      where: { alunoId },
      include: includeExecucao,
      orderBy: { dataExecucao: "desc" },
      take: limite,
    }),
    prisma.historicoTreino.count({ where: { alunoId } }),
    prisma.historicoTreino.count({
      where: { alunoId, dataExecucao: { gte: trintaDiasAtras } },
    }),
    prisma.historicoTreino.aggregate({
      where: { alunoId },
      _sum: { duracaoSeg: true },
    }),
  ]);

  return {
    execucoes: execucoes.map(toExecucao),
    resumo: {
      total,
      noMes,
      minutosTotais: Math.round((duracoes._sum.duracaoSeg ?? 0) / 60),
    },
  };
}

/* -------------------------------------------------------------------------
   Agenda
   ------------------------------------------------------------------------- */

/** Meia-noite local de hoje - o corte das consultas por dia. */
function inicioDeHoje(agora: Date) {
  const inicio = new Date(agora);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export async function minhaAgenda(
  alunoId: string,
  agora: Date = new Date()
): Promise<MinhaAgendaResponse> {
  const [perfil, deHojeEmDiante, anteriores] = await Promise.all([
    prisma.alunoProfile.findUnique({
      where: { id: alunoId },
      select: {
        personalId: true,
        personal: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
      },
    }),
    // A data é gravada na meia-noite do dia; o que separa passado de futuro é
    // o fim do atendimento, senão tudo o que é de hoje viraria histórico.
    prisma.agendamento.findMany({
      where: { alunoId, data: { gte: inicioDeHoje(agora) } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 30,
    }),
    prisma.agendamento.findMany({
      where: { alunoId, data: { lt: inicioDeHoje(agora) } },
      orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
      take: 10,
    }),
  ]);

  // As regras do Personal decidem o que o aluno ainda pode desmarcar.
  const regras = perfil?.personalId ? await regrasDoPersonal(perfil.personalId) : REGRAS_PADRAO;

  // O que já terminou hoje entra no histórico, não nos próximos.
  const proximos: typeof deHojeEmDiante = [];
  const encerradosHoje: typeof deHojeEmDiante = [];

  for (const item of deHojeEmDiante) {
    const fim = instanteDoAtendimento(paraISO(dataDoInstante(item.data)), item.horaFim);
    if (fim.getTime() >= agora.getTime()) proximos.push(item);
    else encerradosHoje.push(item);
  }

  return {
    proximos: proximos.map((item) => toAgendamento(item, regras, agora)),
    anteriores: [...encerradosHoje.reverse(), ...anteriores].map((item) =>
      toAgendamento(item, regras, agora)
    ),
    personal: toPersonal(perfil?.personal ?? null),
    regras,
  };
}

/** Compromisso de pé em uma data de calendário (o horário do treino do dia). */
async function agendamentoEm(alunoId: string, data: Date): Promise<MeuAgendamento | null> {
  const { de, ate } = limitesDoDiaLocal(data);

  const agendamento = await prisma.agendamento.findFirst({
    where: { alunoId, data: { gte: de, lte: ate }, status: { in: [...STATUS_ATIVOS] } },
    orderBy: { data: "asc" },
  });

  return agendamento ? toAgendamento(agendamento) : null;
}

/* -------------------------------------------------------------------------
   Evolução
   ------------------------------------------------------------------------- */

function variacao(
  avaliacoes: MinhaAvaliacao[],
  campo: "peso" | "percentualGordura" | "massaMagra" | "imc"
): VariacaoMetrica | null {
  const comValor = avaliacoes.filter((item) => item[campo] !== null);
  if (comValor.length === 0) return null;

  const atual = comValor[comValor.length - 1][campo]!;
  const anterior = comValor.length > 1 ? comValor[comValor.length - 2][campo]! : null;

  return {
    atual,
    anterior,
    variacao: anterior === null ? null : Number((atual - anterior).toFixed(1)),
  };
}

function toMedidas(valor: Prisma.JsonValue | null): Record<string, number> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;

  const medidas: Record<string, number> = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (typeof item === "number") medidas[chave] = item;
  }
  return Object.keys(medidas).length ? medidas : null;
}

export async function minhaEvolucao(alunoId: string): Promise<MinhaEvolucaoResponse> {
  const registros = await prisma.avaliacao.findMany({
    where: { alunoId },
    orderBy: { data: "asc" },
  });

  const avaliacoes: MinhaAvaliacao[] = registros.map((item) => ({
    id: item.id,
    data: item.data.toISOString(),
    peso: item.peso,
    percentualGordura: item.percentualGordura,
    massaMagra: item.massaMagra,
    massaGorda: item.massaGorda,
    imc: item.imc,
    medidas: toMedidas(item.medidas),
  }));

  return {
    avaliacoes,
    ultima: avaliacoes.at(-1) ?? null,
    peso: variacao(avaliacoes, "peso"),
    percentualGordura: variacao(avaliacoes, "percentualGordura"),
    massaMagra: variacao(avaliacoes, "massaMagra"),
    imc: variacao(avaliacoes, "imc"),
  };
}

/* -------------------------------------------------------------------------
   Feedbacks
   ------------------------------------------------------------------------- */

export async function meusFeedbacks(alunoId: string, limite = 30): Promise<MeuFeedback[]> {
  const feedbacks = await prisma.feedback.findMany({
    where: { alunoId },
    include: {
      personal: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
      avaliacao: { select: { id: true, data: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  return feedbacks.map((item) => ({
    id: item.id,
    texto: item.texto,
    criadoEm: item.createdAt.toISOString(),
    personal: toPersonal(item.personal),
    avaliacao: item.avaliacao
      ? { id: item.avaliacao.id, data: item.avaliacao.data.toISOString() }
      : null,
  }));
}

/* -------------------------------------------------------------------------
   Perfil
   ------------------------------------------------------------------------- */

export async function meuPerfil(alunoId: string): Promise<MeuPerfil | null> {
  const perfil = await prisma.alunoProfile.findUnique({
    where: { id: alunoId },
    include: {
      user: { select: { name: true, email: true, phone: true, avatarUrl: true } },
      personal: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
    },
  });

  if (!perfil) return null;

  return {
    nome: perfil.user.name,
    email: perfil.user.email,
    telefone: perfil.user.phone,
    avatarUrl: perfil.user.avatarUrl,
    dataNascimento: perfil.dataNascimento?.toISOString() ?? null,
    altura: perfil.altura,
    objetivo: perfil.objetivo,
    membroDesde: perfil.createdAt.toISOString(),
    personal: toPersonal(perfil.personal),
  };
}

/**
 * O aluno edita os próprios dados de contato e treino. Status, vínculo com o
 * Personal e e-mail continuam fora do alcance dele.
 */
export async function atualizarMeuPerfil(
  alunoId: string,
  input: EditarMeuPerfilInput
): Promise<MeuPerfil | null> {
  const perfil = await prisma.alunoProfile.findUnique({
    where: { id: alunoId },
    select: { id: true, userId: true },
  });
  if (!perfil) return null;

  await prisma.$transaction(async (tx) => {
    if (input.nome !== undefined || input.telefone !== undefined) {
      await tx.user.update({
        where: { id: perfil.userId },
        data: {
          ...(input.nome !== undefined ? { name: input.nome } : {}),
          ...(input.telefone !== undefined ? { phone: input.telefone || null } : {}),
        },
      });
    }

    await tx.alunoProfile.update({
      where: { id: perfil.id },
      data: {
        ...(input.dataNascimento !== undefined
          ? { dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null }
          : {}),
        ...(input.altura !== undefined ? { altura: input.altura ?? null } : {}),
        ...(input.objetivo !== undefined ? { objetivo: input.objetivo || null } : {}),
      },
    });
  });

  return meuPerfil(alunoId);
}

/* -------------------------------------------------------------------------
   Dashboard
   ------------------------------------------------------------------------- */

/** Junta o previsto pela programação com a ficha completa e o horário do dia. */
async function montarDiaDeTreino(
  alunoId: string,
  previsto: Awaited<ReturnType<typeof treinoPrevistoEm>>,
  hoje: Date
): Promise<DiaDeTreino> {
  const data = new Date(`${previsto.data}T00:00:00.000Z`);

  const [treino, agendamento] = await Promise.all([
    previsto.treino
      ? prisma.treino.findUnique({
          where: { id: previsto.treino.id },
          include: includeTreinoCom(hoje),
        })
      : Promise.resolve(null),
    agendamentoEm(alunoId, data),
  ]);

  return {
    data: previsto.data,
    diaSemana: previsto.diaSemana,
    tipo: previsto.tipo,
    treino: treino ? toMeuTreino(treino) : null,
    executado: previsto.executado,
    agendamento,
  };
}

/**
 * Dias seguidos em que o aluno treinou. Descanso e dias sem programação não
 * quebram a sequência (não havia treino a fazer); o dia de hoje ainda não
 * executado também não, porque o dia não acabou.
 */
function calcularSequencia(
  datas: Date[],
  previstos: Map<string, { tipo: string }>,
  executadas: Set<string>,
  hojeISO: string
): number {
  let sequencia = 0;

  for (const data of [...datas].reverse()) {
    const iso = paraISO(data);
    const previsto = previstos.get(`${iso}`);
    if (!previsto || previsto.tipo !== "TREINO") continue;

    if (executadas.has(iso)) {
      sequencia += 1;
      continue;
    }
    if (iso === hojeISO) continue;
    break;
  }

  return sequencia;
}

export async function meuDashboard(
  alunoId: string,
  agora: Date = new Date()
): Promise<AlunoDashboardResponse> {
  const hoje = dataDoInstante(agora);
  const hojeISO = paraISO(hoje);

  const perfil = await prisma.alunoProfile.findUnique({
    where: { id: alunoId },
    include: {
      user: { select: { name: true, avatarUrl: true } },
      personal: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
    },
  });

  if (!perfil) {
    throw new Error("Perfil de aluno não encontrado.");
  }

  const [previstoHoje, proximoPrevisto, evolucao, feedbacks] = await Promise.all([
    treinoPrevistoEm(alunoId, hoje),
    proximoTreinoDoAluno(alunoId, somarDiasUTC(hoje, 1)),
    minhaEvolucao(alunoId),
    meusFeedbacks(alunoId, 1),
  ]);

  const [diaDeHoje, proximo] = await Promise.all([
    montarDiaDeTreino(alunoId, previstoHoje, hoje),
    proximoPrevisto ? montarDiaDeTreino(alunoId, proximoPrevisto, hoje) : Promise.resolve(null),
  ]);

  // Semana corrente (domingo a sábado) + janela da sequência, resolvidas em
  // uma consulta só de programações e uma de histórico.
  const inicioSemana = somarDiasUTC(hoje, -hoje.getUTCDay());
  const fimSemana = somarDiasUTC(inicioSemana, 6);
  const inicioJanela = somarDiasUTC(hoje, -JANELA_SEQUENCIA_DIAS);

  const datasJanela = intervaloDeDatas(inicioJanela, fimSemana);

  const [previstos, execucoes] = await Promise.all([
    treinosPrevistosPara(datasJanela.map((data) => ({ alunoId, data }))),
    prisma.historicoTreino.findMany({
      where: {
        alunoId,
        dataExecucao: { gte: inicioJanela },
      },
      select: { dataExecucao: true },
    }),
  ]);

  const executadas = new Set(execucoes.map((item) => paraISO(dataDoInstante(item.dataExecucao))));
  const porData = new Map(
    datasJanela.map((data) => {
      const iso = paraISO(data);
      return [iso, previstos.get(`${alunoId}:${iso}`) ?? { tipo: "SEM_PROGRAMACAO" as const }];
    })
  );

  const datasDaSemana = intervaloDeDatas(inicioSemana, fimSemana).map(paraISO);
  const treinosNaSemana = datasDaSemana.filter(
    (iso) => porData.get(iso)?.tipo === "TREINO"
  ).length;
  const concluidosNaSemana = datasDaSemana.filter((iso) => executadas.has(iso)).length;

  const totalExecucoes = await prisma.historicoTreino.count({ where: { alunoId } });

  return {
    aluno: {
      nome: perfil.user.name,
      primeiroNome: perfil.user.name.split(" ")[0],
      avatarUrl: perfil.user.avatarUrl,
    },
    hoje: diaDeHoje,
    proximo,
    resumo: {
      treinosNaSemana,
      concluidosNaSemana,
      sequencia: calcularSequencia(
        intervaloDeDatas(inicioJanela, hoje),
        porData,
        executadas,
        hojeISO
      ),
      totalExecucoes,
    },
    evolucao,
    ultimoFeedback: feedbacks[0] ?? null,
    personal: toPersonal(perfil.personal),
  };
}
