import type { DiaSemana, StatusAgendamento } from "@/types";
import type { TreinoItemExercicio } from "@/types/treino";

/** Ficha do aluno, como ele mesmo vê (sem nada do Personal além do nome). */
export type MeuTreino = {
  id: string;
  nome: string;
  observacoes: string | null;
  ativo: boolean;
  totalExercicios: number;
  /** Grupos musculares trabalhados, na ordem dos exercícios. */
  grupos: string[];
  /** Minutos estimados a partir de séries e descanso. */
  duracaoMin: number;
  /** Dias da semana em que a programação vigente prescreve este treino. */
  diasProgramados: DiaSemana[];
  ultimaExecucao: string | null;
  totalExecucoes: number;
};

export type MeuTreinoDetalhe = MeuTreino & {
  exercicios: TreinoItemExercicio[];
};

export type MeusTreinosResponse = {
  treinos: MeuTreino[];
  /** Execuções mais recentes, para o histórico da tela de treinos. */
  historico: ExecucaoRegistrada[];
};

/** Um exercício como ele foi realizado na sessão (retrato do momento). */
export type ExercicioExecutado = {
  id: string;
  ordem: number;
  nome: string;
  grupoMuscular: string;
  series: number;
  repeticoes: string;
  carga: string | null;
  concluido: boolean;
  observacoes: string | null;
};

export type ExecucaoRegistrada = {
  id: string;
  data: string;
  concluido: boolean;
  observacoes: string | null;
  /** Tempo cronometrado da sessão, quando ela passou pela tela de execução. */
  duracaoSeg: number | null;
  treino: { id: string; nome: string };
  itens: ExercicioExecutado[];
  /** Exercícios marcados como feitos / total registrado. */
  exerciciosConcluidos: number;
  totalExercicios: number;
  /** Soma das séries concluídas. */
  totalSeries: number;
};

export type MeuHistoricoResponse = {
  execucoes: ExecucaoRegistrada[];
  resumo: {
    total: number;
    /** Execuções nos últimos 30 dias. */
    noMes: number;
    /** Minutos somados das sessões cronometradas. */
    minutosTotais: number;
  };
};

/** O que está previsto para uma data, já com a ficha resumida. */
export type DiaDeTreino = {
  data: string;
  diaSemana: DiaSemana;
  tipo: "TREINO" | "DESCANSO" | "SEM_PROGRAMACAO";
  treino: MeuTreino | null;
  /** Já registrou execução nesta data. */
  executado: boolean;
  /** Horário marcado com o Personal nesta data, se houver. */
  agendamento: MeuAgendamento | null;
};

export type MeuAgendamento = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: StatusAgendamento;
  observacoes: string | null;
};

export type MinhaAgendaResponse = {
  proximos: MeuAgendamento[];
  anteriores: MeuAgendamento[];
  personal: MeuPersonal | null;
};

export type MeuPersonal = {
  nome: string;
  email: string;
  avatarUrl: string | null;
};

export type MinhaAvaliacao = {
  id: string;
  data: string;
  peso: number | null;
  percentualGordura: number | null;
  massaMagra: number | null;
  massaGorda: number | null;
  imc: number | null;
  medidas: Record<string, number> | null;
};

/** Variação entre a primeira e a última avaliação de uma métrica. */
export type VariacaoMetrica = {
  atual: number;
  anterior: number | null;
  /** atual - anterior (null quando só existe uma avaliação). */
  variacao: number | null;
};

export type MinhaEvolucaoResponse = {
  avaliacoes: MinhaAvaliacao[];
  ultima: MinhaAvaliacao | null;
  peso: VariacaoMetrica | null;
  percentualGordura: VariacaoMetrica | null;
  massaMagra: VariacaoMetrica | null;
  imc: VariacaoMetrica | null;
};

export type MeuFeedback = {
  id: string;
  texto: string;
  criadoEm: string;
  personal: MeuPersonal | null;
  /** Avaliação a que o feedback está preso, quando houver. */
  avaliacao: { id: string; data: string } | null;
};

export type MeusFeedbacksResponse = {
  feedbacks: MeuFeedback[];
};

export type MeuPerfil = {
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  dataNascimento: string | null;
  altura: number | null;
  objetivo: string | null;
  membroDesde: string;
  personal: MeuPersonal | null;
};

export type AlunoDashboardResponse = {
  aluno: { nome: string; primeiroNome: string; avatarUrl: string | null };
  hoje: DiaDeTreino;
  /** Próximo dia com treino previsto depois de hoje (até 14 dias à frente). */
  proximo: DiaDeTreino | null;
  resumo: {
    /** Dias com treino previsto na semana corrente (domingo a sábado). */
    treinosNaSemana: number;
    /** Execuções registradas nessa mesma semana. */
    concluidosNaSemana: number;
    /** Dias seguidos com treino previsto e executado, contando de ontem/hoje. */
    sequencia: number;
    totalExecucoes: number;
  };
  evolucao: MinhaEvolucaoResponse;
  ultimoFeedback: MeuFeedback | null;
  personal: MeuPersonal | null;
};
