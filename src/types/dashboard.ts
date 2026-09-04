import type { DiaSemana, StatusAgendamento } from "@/types";

export type DashboardResumo = {
  /** Todos os alunos vinculados ao Personal. */
  totalAlunos: number;
  /**
   * Alunos com treino ativo ou com atividade (agendamento/execução) nos
   * últimos 30 dias.
   */
  alunosAtivos: number;
  /** Treinos ativos programados para o dia da semana de hoje. */
  treinosDoDia: number;
  /** Agendamentos futuros ainda não cancelados. */
  proximosAgendamentos: number;
  /** Avaliações registradas nos últimos 30 dias. */
  avaliacoesRecentes: number;
};

export type DashboardAgendamento = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: StatusAgendamento;
  observacoes: string | null;
  aluno: { id: string; nome: string };
  /**
   * Treino programado para o dia da semana do agendamento (o schema não
   * vincula agendamento a treino; o "tipo" é derivado da programação).
   */
  treino: { id: string; nome: string; diaSemana: DiaSemana } | null;
};

export type DashboardAluno = {
  id: string;
  nome: string;
  email: string;
  objetivo: string | null;
  criadoEm: string;
  ativo: boolean;
  totalTreinos: number;
  proximoTreino: { id: string; nome: string; diaSemana: DiaSemana } | null;
  ultimaExecucao: string | null;
};

export type DashboardAvaliacao = {
  id: string;
  data: string;
  peso: number | null;
  percentualGordura: number | null;
  aluno: { id: string; nome: string };
};

export type DashboardData = {
  /** Referência de "hoje" usada pelo servidor (ISO) e o dia da semana. */
  hoje: { data: string; diaSemana: DiaSemana };
  resumo: DashboardResumo;
  agendaDoDia: DashboardAgendamento[];
  proximosAgendamentos: DashboardAgendamento[];
  alunosRecentes: DashboardAluno[];
  avaliacoesRecentes: DashboardAvaliacao[];
};
