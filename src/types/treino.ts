import type { DiaSemana } from "@/types";

export type TreinoItemExercicio = {
  id: string;
  ordem: number;
  series: number;
  repeticoes: string;
  carga: string | null;
  descansoSeg: number | null;
  observacoes: string | null;
  exercicio: {
    id: string;
    nome: string;
    grupoMuscular: string;
    imagemUrl: string | null;
    videoUrl: string | null;
    ativo: boolean;
  };
};

export type TreinoListItem = {
  id: string;
  nome: string;
  diaSemana: DiaSemana;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  aluno: { id: string; nome: string; avatarUrl: string | null };
  totalExercicios: number;
  /** Grupos musculares trabalhados, para dar contexto na listagem. */
  grupos: string[];
  ultimaExecucao: string | null;
};

export type TreinoDetalhe = TreinoListItem & {
  exercicios: TreinoItemExercicio[];
};

export type TreinoListResponse = {
  treinos: TreinoListItem[];
  total: number;
  contagens: { todos: number; ativos: number; inativos: number };
};
