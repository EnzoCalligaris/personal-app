import "server-only";

import { prisma } from "@/lib/prisma";
import type { Notificacao, NotificacoesResponse } from "@/types/feedback";

/**
 * Notificações internas: ficam dentro do app, na campainha da barra superior.
 * Não há e-mail nem push - o que existe é o aviso que o usuário vê ao entrar.
 */

const LIMITE = 20;

export async function minhasNotificacoes(userId: string): Promise<NotificacoesResponse> {
  const [registros, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
    }),
    prisma.notificacao.count({ where: { userId, lida: false } }),
  ]);

  const notificacoes: Notificacao[] = registros.map((item) => ({
    id: item.id,
    tipo: item.tipo,
    titulo: item.titulo,
    mensagem: item.mensagem,
    lida: item.lida,
    link: item.link,
    criadaEm: item.createdAt.toISOString(),
  }));

  return { notificacoes, naoLidas };
}

/** Marca uma notificação como lida - só do próprio usuário. */
export async function marcarNotificacaoLida(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.notificacao.updateMany({
    where: { id, userId },
    data: { lida: true },
  });
  return count > 0;
}

export async function marcarTodasLidas(userId: string): Promise<number> {
  const { count } = await prisma.notificacao.updateMany({
    where: { userId, lida: false },
    data: { lida: true },
  });
  return count;
}
