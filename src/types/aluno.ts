import type { DiaSemana } from "@/types";

export type StatusAluno = "ATIVO" | "INATIVO";

export type AlunoTreinoResumo = {
  id: string;
  nome: string;
  diaSemana: DiaSemana;
};

export type AlunoAvaliacaoResumo = {
  id: string;
  data: string;
  peso: number | null;
  percentualGordura: number | null;
};

/** Aluno como aparece na listagem. */
export type AlunoListItem = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  status: StatusAluno;
  criadoEm: string;
  proximoTreino: AlunoTreinoResumo | null;
  ultimaAvaliacao: AlunoAvaliacaoResumo | null;
};

export type AlunoListResponse = {
  alunos: AlunoListItem[];
  total: number;
  /** Contagens do conjunto completo (ignoram a busca), para os filtros. */
  contagens: { todos: number; ativos: number; inativos: number };
};

/** Aluno na página de detalhe. */
export type AlunoDetalhe = AlunoListItem & {
  dataNascimento: string | null;
  altura: number | null;
  objetivo: string | null;
  observacoes: string | null;
  metricas: {
    totalTreinos: number;
    treinosAtivos: number;
    totalAgendamentos: number;
    proximoAgendamento: string | null;
    totalAvaliacoes: number;
    ultimaExecucao: string | null;
  };
};

export type CriarAlunoResponse = {
  aluno: AlunoListItem;
  /**
   * Senha temporária gerada para o primeiro acesso do aluno - exibida uma
   * única vez para o Personal repassar.
   */
  senhaTemporaria: string;
};
