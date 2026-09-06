import type { TipoNotificacao } from "@/types/feedback";

/**
 * Catálogo de eventos notificáveis. Cada evento carrega o que precisa para
 * escrever a mensagem - o texto fica aqui, e não espalhado pelas queries, para
 * um dia sair igual no app, no e-mail e no WhatsApp.
 */
export type EventoNotificacao =
  | { tipo: "NOVO_TREINO"; alunoId: string; treino: { id: string; nome: string } }
  | { tipo: "TREINO_ALTERADO"; alunoId: string; treino: { id: string; nome: string } }
  | { tipo: "NOVA_AVALIACAO"; alunoId: string; data: string }
  | { tipo: "NOVO_FEEDBACK"; alunoId: string; texto: string }
  | {
      tipo: "AGENDAMENTO_CONFIRMADO";
      alunoId: string;
      quando: { data: string; horaInicio: string; horaFim: string };
    }
  | {
      tipo: "AGENDAMENTO_CANCELADO";
      /** Quem recebe: o aluno (cancelado pelo Personal) ou o Personal. */
      alunoId?: string;
      personalId?: string;
      porQuem: "PERSONAL" | "ALUNO";
      quem: string;
      quando: { data: string; horaInicio: string; horaFim: string };
    }
  | {
      tipo: "AGENDAMENTO_REAGENDADO";
      alunoId?: string;
      personalId?: string;
      porQuem: "PERSONAL" | "ALUNO";
      quem: string;
      quando: { data: string; horaInicio: string; horaFim: string };
    }
  | {
      tipo: "NOVO_AGENDAMENTO";
      personalId: string;
      quem: string;
      quando: { data: string; horaInicio: string; horaFim: string };
    };

export type MensagemNotificacao = {
  /** Usuário que recebe (users.id). */
  userId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link: string | null;
};

/** "2026-09-07" + "07:00" -> "segunda, 07/09 às 07:00" */
function quandoPorExtenso(quando: { data: string; horaInicio: string }) {
  const [ano, mes, dia] = quando.data.split("-").map(Number);
  const formatado = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(ano, mes - 1, dia));

  return `${formatado} às ${quando.horaInicio}`;
}

function resumir(texto: string, limite = 120) {
  return texto.length > limite ? `${texto.slice(0, limite - 3)}...` : texto;
}

/** Título, mensagem e link de cada evento - o mesmo para todos os canais. */
export function montarMensagem(evento: EventoNotificacao): Omit<MensagemNotificacao, "userId"> {
  switch (evento.tipo) {
    case "NOVO_TREINO":
      return {
        tipo: "NOVO_TREINO",
        titulo: "Novo treino na sua ficha",
        mensagem: `Seu Personal montou "${evento.treino.nome}".`,
        link: `/aluno/treinos/${evento.treino.id}`,
      };

    case "TREINO_ALTERADO":
      return {
        tipo: "TREINO_ALTERADO",
        titulo: "Seu treino foi atualizado",
        mensagem: `"${evento.treino.nome}" mudou - confira antes do próximo treino.`,
        link: `/aluno/treinos/${evento.treino.id}`,
      };

    case "NOVA_AVALIACAO":
      return {
        tipo: "NOVA_AVALIACAO",
        titulo: "Nova avaliação registrada",
        mensagem: "Seu Personal registrou uma avaliação de bioimpedância.",
        link: "/aluno/evolucao",
      };

    case "NOVO_FEEDBACK":
      return {
        tipo: "NOVO_FEEDBACK",
        titulo: "Novo feedback do seu Personal",
        mensagem: resumir(evento.texto),
        link: "/aluno/feedback",
      };

    case "AGENDAMENTO_CONFIRMADO":
      return {
        tipo: "AGENDAMENTO_CONFIRMADO",
        titulo: "Treino confirmado",
        mensagem: `Seu atendimento de ${quandoPorExtenso(evento.quando)} está confirmado.`,
        link: "/aluno/agenda",
      };

    case "AGENDAMENTO_CANCELADO":
      return evento.porQuem === "PERSONAL"
        ? {
            tipo: "AGENDAMENTO_CANCELADO",
            titulo: "Atendimento cancelado",
            mensagem: `${evento.quem} cancelou o horário de ${quandoPorExtenso(evento.quando)}.`,
            link: "/aluno/agenda",
          }
        : {
            tipo: "AGENDAMENTO_CANCELADO",
            titulo: "Cancelamento de aluno",
            mensagem: `${evento.quem} cancelou o horário de ${quandoPorExtenso(evento.quando)}.`,
            link: "/personal/agenda",
          };

    case "AGENDAMENTO_REAGENDADO":
      return evento.porQuem === "PERSONAL"
        ? {
            tipo: "AGENDAMENTO_REAGENDADO",
            titulo: "Horário remarcado",
            mensagem: `${evento.quem} moveu seu atendimento para ${quandoPorExtenso(evento.quando)}.`,
            link: "/aluno/agenda",
          }
        : {
            tipo: "AGENDAMENTO_REAGENDADO",
            titulo: "Aluno remarcou o horário",
            mensagem: `${evento.quem} moveu o atendimento para ${quandoPorExtenso(evento.quando)}.`,
            link: "/personal/agenda",
          };

    case "NOVO_AGENDAMENTO":
      return {
        tipo: "NOVO_AGENDAMENTO",
        titulo: "Novo agendamento",
        mensagem: `${evento.quem} marcou ${quandoPorExtenso(evento.quando)}.`,
        link: "/personal/agenda",
      };
  }
}
