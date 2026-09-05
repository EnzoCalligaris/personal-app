import "server-only";
import { prisma } from "@/lib/prisma";
import type { DiaSemana } from "@/types";
import { diaSemanaDe, diasAtras, fimDoDia, inicioDoDia } from "@/lib/date-utils";
import type {
  DashboardAgendamento,
  DashboardAluno,
  DashboardAvaliacao,
  DashboardData,
} from "@/types/dashboard";

/** Status que ainda representam um compromisso de pé. */
const STATUS_ATIVOS = ["AGENDADO", "REAGENDADO"] as const;

const JANELA_ATIVIDADE_DIAS = 30;
const LIMITE_AGENDA = 8;
const LIMITE_ALUNOS = 5;
const LIMITE_AVALIACOES = 5;

/**
 * Monta o dashboard do Personal a partir do banco. Tudo é filtrado pelo
 * `personalId` do próprio Personal autenticado - nenhum dado de outro
 * profissional entra aqui.
 */
export async function getDashboardData(
  personalId: string,
  agora: Date = new Date()
): Promise<DashboardData> {
  const hoje = diaSemanaDe(agora);
  const inicioHoje = inicioDoDia(agora);
  const fimHoje = fimDoDia(agora);
  const janelaAtividade = diasAtras(agora, JANELA_ATIVIDADE_DIAS);

  const [
    totalAlunos,
    alunosAtivos,
    treinosDoDia,
    proximosAgendamentosCount,
    avaliacoesRecentesCount,
    agendaDoDiaRaw,
    proximosAgendamentosRaw,
    alunosRecentesRaw,
    avaliacoesRecentesRaw,
  ] = await Promise.all([
    prisma.alunoProfile.count({ where: { personalId } }),

    prisma.alunoProfile.count({ where: { personalId, status: "ATIVO" } }),

    prisma.treino.count({ where: { personalId, ativo: true, diaSemana: hoje } }),

    prisma.agendamento.count({
      where: { personalId, data: { gte: agora }, status: { in: [...STATUS_ATIVOS] } },
    }),

    prisma.avaliacao.count({ where: { personalId, data: { gte: janelaAtividade } } }),

    prisma.agendamento.findMany({
      where: { personalId, data: { gte: inicioHoje, lte: fimHoje } },
      include: { aluno: { include: { user: { select: { name: true } } } } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: LIMITE_AGENDA,
    }),

    prisma.agendamento.findMany({
      where: { personalId, data: { gt: fimHoje }, status: { in: [...STATUS_ATIVOS] } },
      include: { aluno: { include: { user: { select: { name: true } } } } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: LIMITE_AGENDA,
    }),

    prisma.alunoProfile.findMany({
      where: { personalId },
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        treinos: {
          where: { ativo: true },
          select: { id: true, nome: true, diaSemana: true },
          orderBy: { createdAt: "desc" },
        },
        historico: {
          select: { dataExecucao: true },
          orderBy: { dataExecucao: "desc" },
          take: 1,
        },
      },
      orderBy: { user: { createdAt: "desc" } },
      take: LIMITE_ALUNOS,
    }),

    prisma.avaliacao.findMany({
      where: { personalId },
      include: { aluno: { include: { user: { select: { name: true } } } } },
      orderBy: { data: "desc" },
      take: LIMITE_AVALIACOES,
    }),
  ]);

  // "Tipo de treino" de cada agendamento: o treino ativo programado para o
  // dia da semana daquela data (o schema não liga agendamento a treino).
  const alunoIdsNaAgenda = [
    ...new Set([...agendaDoDiaRaw, ...proximosAgendamentosRaw].map((a) => a.alunoId)),
  ];

  const treinosDosAlunosNaAgenda = alunoIdsNaAgenda.length
    ? await prisma.treino.findMany({
        where: { personalId, ativo: true, alunoId: { in: alunoIdsNaAgenda } },
        select: { id: true, nome: true, diaSemana: true, alunoId: true },
      })
    : [];

  const treinoPorAlunoEDia = new Map<string, { id: string; nome: string; diaSemana: DiaSemana }>();
  for (const treino of treinosDosAlunosNaAgenda) {
    treinoPorAlunoEDia.set(`${treino.alunoId}:${treino.diaSemana}`, {
      id: treino.id,
      nome: treino.nome,
      diaSemana: treino.diaSemana,
    });
  }

  type AgendamentoRaw = (typeof agendaDoDiaRaw)[number];

  const mapAgendamento = (item: AgendamentoRaw): DashboardAgendamento => ({
    id: item.id,
    data: item.data.toISOString(),
    horaInicio: item.horaInicio,
    horaFim: item.horaFim,
    status: item.status,
    observacoes: item.observacoes,
    aluno: { id: item.alunoId, nome: item.aluno.user.name },
    treino: treinoPorAlunoEDia.get(`${item.alunoId}:${diaSemanaDe(item.data)}`) ?? null,
  });

  const alunosRecentes: DashboardAluno[] = alunosRecentesRaw.map((aluno) => ({
    id: aluno.id,
    nome: aluno.user.name,
    email: aluno.user.email,
    objetivo: aluno.objetivo,
    criadoEm: aluno.user.createdAt.toISOString(),
    ativo: aluno.status === "ATIVO",
    totalTreinos: aluno.treinos.length,
    proximoTreino:
      aluno.treinos.find((treino) => treino.diaSemana === hoje) ?? aluno.treinos[0] ?? null,
    ultimaExecucao: aluno.historico[0]?.dataExecucao.toISOString() ?? null,
  }));

  const avaliacoesRecentes: DashboardAvaliacao[] = avaliacoesRecentesRaw.map((avaliacao) => ({
    id: avaliacao.id,
    data: avaliacao.data.toISOString(),
    peso: avaliacao.peso,
    percentualGordura: avaliacao.percentualGordura,
    aluno: { id: avaliacao.alunoId, nome: avaliacao.aluno.user.name },
  }));

  return {
    hoje: { data: agora.toISOString(), diaSemana: hoje },
    resumo: {
      totalAlunos,
      alunosAtivos,
      treinosDoDia,
      proximosAgendamentos: proximosAgendamentosCount,
      avaliacoesRecentes: avaliacoesRecentesCount,
    },
    agendaDoDia: agendaDoDiaRaw.map(mapAgendamento),
    proximosAgendamentos: proximosAgendamentosRaw.map(mapAgendamento),
    alunosRecentes,
    avaliacoesRecentes,
  };
}
