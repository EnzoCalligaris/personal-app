export type ExercicioItem = {
  id: string;
  nome: string;
  grupoMuscular: string;
  descricao: string | null;
  videoUrl: string | null;
  imagemUrl: string | null;
  ativo: boolean;
  criadoEm: string;
  /** Em quantos treinos este exercício está sendo usado. */
  usadoEmTreinos: number;
};

export type ExercicioListResponse = {
  exercicios: ExercicioItem[];
  total: number;
  contagens: { todos: number; ativos: number; arquivados: number };
  /** Grupos musculares presentes na biblioteca, para montar o filtro. */
  grupos: { nome: string; total: number }[];
};
