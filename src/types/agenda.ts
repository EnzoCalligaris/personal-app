import type { DiaSemana, StatusAgendamento } from "@/types";

/** Uma faixa de trabalho do Personal (ex.: segunda, 06:00 às 12:00). */
export type FaixaDeTrabalho = {
  id: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  /** Tamanho de cada atendimento gerado dentro da faixa. */
  duracaoMin: number;
};

export type BloqueioAgenda = {
  id: string;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  motivo: string | null;
  /** Sem hora de início/fim: o dia inteiro está bloqueado. */
  diaInteiro: boolean;
};

export type AgendamentoAgenda = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: StatusAgendamento;
  observacoes: string | null;
  aluno: { id: string; nome: string; avatarUrl: string | null };
  /** Treino que a programação prevê para o aluno naquele dia. */
  treino: { id: string; nome: string } | null;
};

export type SlotLivre = { horaInicio: string; horaFim: string };

export type DiaDaAgenda = {
  data: string;
  diaSemana: DiaSemana;
  agendamentos: AgendamentoAgenda[];
  bloqueios: BloqueioAgenda[];
  /** Horários livres gerados a partir dos horários de trabalho. */
  livres: SlotLivre[];
  /** As faixas de trabalho do dia, para desenhar a régua do calendário. */
  trabalho: { horaInicio: string; horaFim: string }[];
};

export type VistaAgenda = "dia" | "semana" | "mes";

export type AgendaResponse = {
  vista: VistaAgenda;
  /** Data de referência da navegação (o dia clicado). */
  referencia: string;
  de: string;
  ate: string;
  dias: DiaDaAgenda[];
  resumo: {
    agendamentos: number;
    confirmados: number;
    pendentes: number;
    realizados: number;
    /** Horários livres no período (apenas nas vistas de dia e semana). */
    livres: number;
  };
};

export type HorariosLivresResponse = {
  data: string;
  diaSemana: DiaSemana;
  livres: SlotLivre[];
  /** Por que não há horário: sem faixa de trabalho, dia bloqueado ou lotado. */
  motivo: "OK" | "SEM_TRABALHO" | "BLOQUEADO" | "LOTADO";
};

export type HorariosDeTrabalhoResponse = {
  faixas: FaixaDeTrabalho[];
};

/** Regras que o Personal define para o aluno marcar sozinho. */
export type RegrasAgendamento = {
  permiteAgendamento: boolean;
  antecedenciaMinHoras: number;
  janelaDias: number;
  cancelamentoMinHoras: number;
  maxAtivosPorAluno: number;
  confirmacaoAutomatica: boolean;
};
