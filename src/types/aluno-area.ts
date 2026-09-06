import type { DiaSemana, StatusAgendamento } from "@/types";
import type { RegrasAgendamento } from "@/types/agenda";
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

/* -------------------------------------------------------------------------
   Evolução dos treinos
   ------------------------------------------------------------------------- */

/** Uma semana da frequência: quanto foi previsto e quanto foi feito. */
export type SemanaDeTreino = {
  inicio: string;
  fim: string;
  realizados: number;
  previstos: number;
};

/** O exercício em uma sessão: a melhor carga daquele dia. */
export type PontoDeCarga = {
  data: string;
  /** Como estava escrito na ficha ("40kg", "peso corporal"). */
  carga: string | null;
  /** O número extraído da carga - null quando não há um. */
  cargaKg: number | null;
  series: number;
  repeticoes: string;
};

export type EvolucaoExercicio = {
  chave: string;
  nome: string;
  grupoMuscular: string;
  sessoes: number;
  registros: PontoDeCarga[];
  cargaInicial: number | null;
  cargaAtual: number | null;
  /** Maior carga já registrada neste exercício. */
  cargaMaxima: number | null;
  variacaoKg: number | null;
  variacaoPercentual: number | null;
  /** Há pelo menos dois pontos com carga numérica - dá para desenhar. */
  temGrafico: boolean;
};

export type ProgressoResponse = {
  resumo: {
    /** Sessões registradas como concluídas. */
    totalConcluidos: number;
    naSemana: number;
    /** Média de treinos por semana desde o primeiro registro (máx. 12 semanas). */
    frequenciaSemanal: number;
    sequenciaAtual: number;
    melhorSequencia: number;
    /** Previsto x realizado nas últimas 4 semanas (null sem programação). */
    aderencia: { previstos: number; realizados: number } | null;
    primeiroTreino: string | null;
  };
  /** Últimas 12 semanas, da mais antiga para a mais recente. */
  semanas: SemanaDeTreino[];
  /** Exercícios já executados, dos mais treinados para os menos. */
  exercicios: EvolucaoExercicio[];
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
  /** O aluno ainda está dentro do prazo para cancelar ou reagendar. */
  podeDesmarcar: boolean;
};

export type MinhaAgendaResponse = {
  proximos: MeuAgendamento[];
  anteriores: MeuAgendamento[];
  personal: MeuPersonal | null;
  regras: RegrasAgendamento;
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
  massaMuscular: VariacaoMetrica | null;
  massaMagra: VariacaoMetrica | null;
  imc: VariacaoMetrica | null;
  aguaPercentual: VariacaoMetrica | null;
};

export type MeuFeedback = {
  id: string;
  texto: string;
  criadoEm: string;
  personal: MeuPersonal | null;
  /** Avaliação a que o feedback está preso, quando houver. */
  avaliacao: { id: string; data: string } | null;
  /** O aluno já abriu este comentário. */
  lido: boolean;
};

export type MeusFeedbacksResponse = {
  feedbacks: MeuFeedback[];
  naoLidos: number;
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

/* -------------------------------------------------------------------------
   Agendamento pelo aluno
   ------------------------------------------------------------------------- */

/** Um dia da janela de agendamento, com quantos horários ele tem livres. */
export type DiaParaAgendar = {
  data: string;
  diaSemana: DiaSemana;
  livres: number;
  /** Nenhum horário pode ser marcado neste dia (passado, fora da janela...). */
  indisponivel: boolean;
};

export type HorariosParaAgendarResponse = {
  data: string;
  livres: { horaInicio: string; horaFim: string }[];
  /** Por que a lista veio vazia. */
  motivo:
    | "OK"
    | "SEM_TRABALHO"
    | "BLOQUEADO"
    | "LOTADO"
    | "PASSADO"
    | "ANTECEDENCIA"
    | "FORA_DA_JANELA"
    | "AGENDAMENTO_DESATIVADO"
    | "LIMITE_ATINGIDO";
  mensagem: string | null;
};

export type DiasParaAgendarResponse = {
  de: string;
  ate: string;
  dias: DiaParaAgendar[];
  regras: RegrasAgendamento;
  /** Quantos atendimentos futuros o aluno já tem. */
  ativos: number;
  personal: MeuPersonal | null;
};
