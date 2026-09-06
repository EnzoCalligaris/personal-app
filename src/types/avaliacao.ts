/**
 * Avaliação de bioimpedância. Todas as medidas são opcionais: cada balança
 * entrega um conjunto diferente, e o que o equipamento não mediu fica nulo.
 */
export type Avaliacao = {
  id: string;
  data: string;
  aluno: { id: string; nome: string; avatarUrl: string | null };

  peso: number | null;
  imc: number | null;
  percentualGordura: number | null;
  massaGorda: number | null;
  massaMagra: number | null;
  massaMuscular: number | null;
  massaOssea: number | null;
  aguaPercentual: number | null;
  aguaLitros: number | null;
  gorduraVisceral: number | null;
  metabolismoBasal: number | null;
  idadeMetabolica: number | null;

  observacoes: string | null;
  medidas: Record<string, number> | null;

  /** Diferença para a avaliação anterior do mesmo aluno, quando existe. */
  variacao: {
    peso: number | null;
    percentualGordura: number | null;
    massaMuscular: number | null;
  } | null;
};

export type AvaliacaoListResponse = {
  avaliacoes: Avaliacao[];
  total: number;
  /** Alunos com avaliação registrada, para o filtro. */
  alunos: { id: string; nome: string; total: number }[];
};
