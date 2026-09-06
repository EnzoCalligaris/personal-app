import "server-only";
import { prisma } from "@/lib/prisma";
import { STATUS_ATIVOS } from "@/lib/agenda/status";
import { horaDeParede } from "@/lib/fuso";
import {
  somarDiasUTC,
  dataDeCalendario,
  diaSemanaDe,
  hojeUTC,
} from "@/lib/date-utils";
import {
  proximosTreinosDeAlunos,
  treinosPrevistosHoje,
  treinosPrevistosPara,
} from "@/lib/programacoes/queries";
import type {
  DashboardAgendamento,
  DashboardAluno,
  DashboardAvaliacao,
  DashboardData,
} from "@/types/dashboard";

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
  const hojeData = hojeUTC(agora);
  const horaAgora = horaDeParede(agora);
  const janelaAtividade = somarDiasUTC(hojeData, -JANELA_ATIVIDADE_DIAS);

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

    treinosPrevistosHoje(personalId, hojeData),

    prisma.agendamento.count({
      where: {
        personalId,
        status: { in: [...STATUS_ATIVOS] },
        OR: [{ data: { gt: hojeData } }, { data: hojeData, horaInicio: { gt: horaAgora } }],
      },
    }),

    prisma.avaliacao.count({ where: { personalId, data: { gte: janelaAtividade } } }),

    prisma.agendamento.findMany({
      where: { personalId, data: hojeData },
      include: { aluno: { include: { user: { select: { name: true } } } } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: LIMITE_AGENDA,
    }),

    prisma.agendamento.findMany({
      where: { personalId, data: { gt: hojeData }, status: { in: [...STATUS_ATIVOS] } },
      include: { aluno: { include: { user: { select: { name: true } } } } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: LIMITE_AGENDA,
    }),

    prisma.alunoProfile.findMany({
      where: { personalId },
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        historico: {
          select: { dataExecucao: true },
          orderBy: { dataExecucao: "desc" },
          take: 1,
        },
        _count: { select: { treinos: true } },
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

  // O "tipo de treino" de cada agendamento é o que a programação do aluno
  // prevê para aquela data.
  const agendamentos = [...agendaDoDiaRaw, ...proximosAgendamentosRaw];
  const previstosNaAgenda = await treinosPrevistosPara(
    agendamentos.map((item) => ({
      alunoId: item.alunoId,
      data: item.data,
    }))
  );

  type AgendamentoRaw = (typeof agendaDoDiaRaw)[number];

  const mapAgendamento = (item: AgendamentoRaw): DashboardAgendamento => {
    const previsto = previstosNaAgenda.get(
      `${item.alunoId}:${dataDeCalendario(item.data)}`
    );

    return {
      id: item.id,
      data: item.data.toISOString(),
      horaInicio: item.horaInicio,
      horaFim: item.horaFim,
      status: item.status,
      observacoes: item.observacoes,
      aluno: { id: item.alunoId, nome: item.aluno.user.name },
      treino:
        previsto?.tipo === "TREINO" && previsto.treino
          ? { id: previsto.treino.id, nome: previsto.treino.nome, diaSemana: previsto.diaSemana }
          : null,
    };
  };

  // Próximo treino de cada aluno da lista, resolvido pela programação.
  const proximosPorAluno = await proximosTreinosDeAlunos(
    alunosRecentesRaw.map((aluno) => aluno.id),
    hojeData
  );

  const alunosRecentes: DashboardAluno[] = alunosRecentesRaw.map((aluno) => {
    const proximo = proximosPorAluno.get(aluno.id);

    return {
      id: aluno.id,
      nome: aluno.user.name,
      email: aluno.user.email,
      objetivo: aluno.objetivo,
      criadoEm: aluno.user.createdAt.toISOString(),
      ativo: aluno.status === "ATIVO",
      totalTreinos: aluno._count.treinos,
      proximoTreino:
        proximo?.treino
          ? {
              id: proximo.treino.id,
              nome: proximo.treino.nome,
              diaSemana: proximo.diaSemana,
              data: proximo.data,
            }
          : null,
      ultimaExecucao: aluno.historico[0]?.dataExecucao.toISOString() ?? null,
    };
  });

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
