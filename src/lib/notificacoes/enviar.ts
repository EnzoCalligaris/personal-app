import "server-only";

import { prisma } from "@/lib/prisma";
import { canaisHabilitados } from "@/lib/notificacoes/canais";
import { montarMensagem, type EventoNotificacao } from "@/lib/notificacoes/eventos";

/**
 * Despachante de notificações.
 *
 * Quem executa a ação (criar treino, confirmar agendamento...) só descreve o
 * **evento**; daqui para frente é responsabilidade deste módulo descobrir o
 * destinatário, escrever a mensagem e entregá-la em cada canal habilitado.
 *
 * Nada aqui derruba a ação que disparou o evento: uma falha de entrega vira
 * log. Ninguém perde um treino porque a notificação falhou.
 */

/** Descobre o usuário que recebe - o evento aponta o perfil, não o usuário. */
async function destinatario(evento: EventoNotificacao): Promise<string | null> {
  if ("alunoId" in evento && evento.alunoId) {
    const aluno = await prisma.alunoProfile.findUnique({
      where: { id: evento.alunoId },
      select: { userId: true },
    });
    return aluno?.userId ?? null;
  }

  if ("personalId" in evento && evento.personalId) {
    const personal = await prisma.personalProfile.findUnique({
      where: { id: evento.personalId },
      select: { userId: true },
    });
    return personal?.userId ?? null;
  }

  return null;
}

export async function notificar(evento: EventoNotificacao): Promise<void> {
  try {
    const userId = await destinatario(evento);
    if (!userId) return;

    const mensagem = { userId, ...montarMensagem(evento) };

    for (const canal of canaisHabilitados()) {
      try {
        await canal.entregar(mensagem);
      } catch (erro) {
        console.error(`Falha ao entregar notificação pelo canal ${canal.nome}:`, erro);
      }
    }
  } catch (erro) {
    console.error("Falha ao despachar notificação:", erro);
  }
}
