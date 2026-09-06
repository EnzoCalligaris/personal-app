import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { criarNotificacao } from "@/lib/notificacoes/queries";
import type { FeedbackItem, FeedbackListResponse } from "@/types/feedback";
import type {
  CriarFeedbackInput,
  EditarFeedbackInput,
  ListarFeedbacksQuery,
} from "@/lib/validations/feedback";

/**
 * Feedbacks do Personal para os alunos dele. O autor é sempre o Personal
 * autenticado, e o aluno precisa ser dele - comentário para aluno de outro
 * profissional nunca é criado nem encontrado.
 */

export class AlunoNaoEncontradoError extends Error {
  constructor() {
    super("Aluno não encontrado.");
    this.name = "AlunoNaoEncontradoError";
  }
}

export class AvaliacaoInvalidaError extends Error {
  constructor() {
    super("A avaliação escolhida não é deste aluno.");
    this.name = "AvaliacaoInvalidaError";
  }
}

const incluirPessoas = {
  personal: { include: { user: { select: { name: true, avatarUrl: true } } } },
  aluno: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  avaliacao: { select: { id: true, data: true } },
} satisfies Prisma.FeedbackInclude;

type FeedbackRaw = Prisma.FeedbackGetPayload<{ include: typeof incluirPessoas }>;

function toFeedback(feedback: FeedbackRaw): FeedbackItem {
  return {
    id: feedback.id,
    texto: feedback.texto,
    criadoEm: feedback.createdAt.toISOString(),
    autor: {
      nome: feedback.personal.user.name,
      avatarUrl: feedback.personal.user.avatarUrl,
    },
    aluno: {
      id: feedback.alunoId,
      nome: feedback.aluno.user.name,
      avatarUrl: feedback.aluno.user.avatarUrl,
    },
    lidoEm: feedback.lidoEm?.toISOString() ?? null,
    lido: feedback.lidoEm !== null,
    avaliacao: feedback.avaliacao
      ? { id: feedback.avaliacao.id, data: feedback.avaliacao.data.toISOString() }
      : null,
  };
}

async function garantirAlunoDoPersonal(personalId: string, alunoId: string) {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });
  if (!aluno) throw new AlunoNaoEncontradoError();
  return aluno;
}

export async function listarFeedbacks(
  personalId: string,
  query: ListarFeedbacksQuery = {}
): Promise<FeedbackListResponse> {
  const busca = query.q?.trim();

  const where: Prisma.FeedbackWhereInput = {
    personalId,
    ...(query.alunoId ? { alunoId: query.alunoId } : {}),
    ...(busca
      ? {
          OR: [
            { texto: { contains: busca, mode: "insensitive" } },
            { aluno: { user: { name: { contains: busca, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [feedbacks, total, naoLidos, porAluno] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: incluirPessoas,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { ...where, lidoEm: null } }),
    prisma.feedback.groupBy({
      by: ["alunoId"],
      where: { personalId },
      _count: { _all: true },
    }),
  ]);

  const nomes = await prisma.alunoProfile.findMany({
    where: { id: { in: porAluno.map((item) => item.alunoId) } },
    select: { id: true, user: { select: { name: true } } },
  });

  return {
    feedbacks: feedbacks.map(toFeedback),
    total,
    naoLidos,
    alunos: porAluno
      .map((item) => ({
        id: item.alunoId,
        nome: nomes.find((aluno) => aluno.id === item.alunoId)?.user.name ?? "Aluno",
        total: item._count._all,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

/**
 * Escreve o comentário e avisa o aluno: a notificação interna é criada na
 * mesma transação, para não existir feedback sem aviso.
 */
export async function criarFeedback(
  personalId: string,
  input: CriarFeedbackInput
): Promise<FeedbackItem> {
  const aluno = await garantirAlunoDoPersonal(personalId, input.alunoId);

  if (input.avaliacaoId) {
    const avaliacao = await prisma.avaliacao.findFirst({
      where: { id: input.avaliacaoId, personalId, alunoId: input.alunoId },
      select: { id: true },
    });
    if (!avaliacao) throw new AvaliacaoInvalidaError();
  }

  const feedback = await prisma.feedback.create({
    data: {
      personalId,
      alunoId: input.alunoId,
      avaliacaoId: input.avaliacaoId ?? null,
      texto: input.texto.trim(),
    },
    include: incluirPessoas,
  });

  await criarNotificacao({
    userId: aluno.userId,
    tipo: "NOVO_FEEDBACK",
    titulo: "Novo feedback do seu Personal",
    mensagem:
      feedback.texto.length > 120 ? `${feedback.texto.slice(0, 117)}...` : feedback.texto,
    link: "/aluno/feedback",
  });

  return toFeedback(feedback);
}

/** Corrigir o texto do comentário; o status de leitura não é mexido. */
export async function atualizarFeedback(
  personalId: string,
  feedbackId: string,
  input: EditarFeedbackInput
): Promise<FeedbackItem | null> {
  const atual = await prisma.feedback.findFirst({
    where: { id: feedbackId, personalId },
    select: { id: true },
  });
  if (!atual) return null;

  const feedback = await prisma.feedback.update({
    where: { id: atual.id },
    data: { texto: input.texto.trim() },
    include: incluirPessoas,
  });

  return toFeedback(feedback);
}

export async function excluirFeedback(
  personalId: string,
  feedbackId: string
): Promise<"excluido" | "nao_encontrado"> {
  const feedback = await prisma.feedback.findFirst({
    where: { id: feedbackId, personalId },
    select: { id: true },
  });
  if (!feedback) return "nao_encontrado";

  await prisma.feedback.delete({ where: { id: feedback.id } });
  return "excluido";
}
