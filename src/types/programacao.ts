import type { DiaSemana } from "@/types";

export type ProgramacaoTreinoResumo = {
  id: string;
  nome: string;
  ativo: boolean;
  totalExercicios: number;
  grupos: string[];
};

export type ProgramacaoDiaItem = {
  diaSemana: DiaSemana;
  treino: ProgramacaoTreinoResumo | null;
};

export type Programacao = {
  id: string;
  nome: string | null;
  dataInicio: string;
  dataFim: string | null;
  observacoes: string | null;
  /** Sempre com os 7 dias, do domingo ao sábado; `treino: null` = descanso. */
  dias: ProgramacaoDiaItem[];
  /** Se a data de hoje cai dentro do período. */
  vigente: boolean;
  /** Já terminou (dataFim no passado). */
  encerrada: boolean;
  criadaEm: string;
};

export type ProgramacaoListResponse = {
  programacoes: Programacao[];
  /** A que vale hoje, se houver. */
  vigente: Programacao | null;
};

/** O que está previsto para uma data específica. */
export type DiaPrevisto = {
  data: string;
  diaSemana: DiaSemana;
  tipo: "TREINO" | "DESCANSO" | "SEM_PROGRAMACAO";
  treino: ProgramacaoTreinoResumo | null;
  /** O dia aponta para um treino desativado - a ficha não deveria ser usada. */
  treinoInativo: boolean;
  programacao: { id: string; nome: string | null } | null;
  /** Houve execução registrada nesta data. */
  executado: boolean;
};

export type CalendarioResponse = {
  de: string;
  ate: string;
  dias: DiaPrevisto[];
};
