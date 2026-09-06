/** Comentário do Personal para um aluno, como o Personal o vê. */
export type FeedbackItem = {
  id: string;
  texto: string;
  criadoEm: string;
  /** Autor do comentário - sempre o Personal que escreveu. */
  autor: { nome: string; avatarUrl: string | null };
  aluno: { id: string; nome: string; avatarUrl: string | null };
  /** Quando o aluno abriu; nulo = ainda não leu. */
  lidoEm: string | null;
  lido: boolean;
  /** Avaliação a que o comentário está preso, quando houver. */
  avaliacao: { id: string; data: string } | null;
};

export type FeedbackListResponse = {
  feedbacks: FeedbackItem[];
  total: number;
  /** Quantos ainda não foram lidos pelos alunos. */
  naoLidos: number;
  /** Alunos com feedback registrado, para o filtro. */
  alunos: { id: string; nome: string; total: number }[];
};

export type TipoNotificacao =
  | "NOVO_TREINO"
  | "TREINO_ALTERADO"
  | "NOVO_AGENDAMENTO"
  | "AGENDAMENTO_CONFIRMADO"
  | "AGENDAMENTO_CANCELADO"
  | "AGENDAMENTO_REAGENDADO"
  | "NOVA_AVALIACAO"
  | "NOVO_FEEDBACK"
  | "LEMBRETE";

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  lida: boolean;
  link: string | null;
  criadaEm: string;
};

export type NotificacoesResponse = {
  notificacoes: Notificacao[];
  naoLidas: number;
};
