import "server-only";
import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { diaSemanaDe } from "@/lib/date-utils";
import type { CriarAlunoInput, EditarAlunoInput, ListarAlunosQuery } from "@/lib/validations/aluno";
import type {
  AlunoDetalhe,
  AlunoListItem,
  AlunoListResponse,
  CriarAlunoResponse,
} from "@/types/aluno";

type AlunoComRelacoes = {
  id: string;
  status: "ATIVO" | "INATIVO";
  createdAt: Date;
  user: { name: string; email: string; phone: string | null; avatarUrl: string | null };
  treinos: { id: string; nome: string; diaSemana: ReturnType<typeof diaSemanaDe> }[];
  avaliacoes: { id: string; data: Date; peso: number | null; percentualGordura: number | null }[];
};

/** Include usado tanto na listagem quanto no detalhe. */
const includeResumo = {
  user: { select: { name: true, email: true, phone: true, avatarUrl: true } },
  treinos: {
    where: { ativo: true },
    select: { id: true, nome: true, diaSemana: true },
    orderBy: { createdAt: "desc" },
  },
  avaliacoes: {
    select: { id: true, data: true, peso: true, percentualGordura: true },
    orderBy: { data: "desc" },
    take: 1,
  },
} as const;

function toListItem(aluno: AlunoComRelacoes, hoje = diaSemanaDe(new Date())): AlunoListItem {
  const ultima = aluno.avaliacoes[0];

  return {
    id: aluno.id,
    nome: aluno.user.name,
    email: aluno.user.email,
    telefone: aluno.user.phone,
    avatarUrl: aluno.user.avatarUrl,
    status: aluno.status,
    criadoEm: aluno.createdAt.toISOString(),
    // Treino do dia, se houver; senão o mais recente cadastrado.
    proximoTreino:
      aluno.treinos.find((treino) => treino.diaSemana === hoje) ?? aluno.treinos[0] ?? null,
    ultimaAvaliacao: ultima
      ? {
          id: ultima.id,
          data: ultima.data.toISOString(),
          peso: ultima.peso,
          percentualGordura: ultima.percentualGordura,
        }
      : null,
  };
}

/** Lista os alunos do Personal, com busca por nome/e-mail e filtro de status. */
export async function listarAlunos(
  personalId: string,
  query: ListarAlunosQuery
): Promise<AlunoListResponse> {
  const busca = query.q?.trim();

  const where = {
    personalId,
    ...(query.status !== "TODOS" ? { status: query.status } : {}),
    ...(busca
      ? {
          user: {
            OR: [
              { name: { contains: busca, mode: "insensitive" as const } },
              { email: { contains: busca, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [alunos, total, todos, ativos] = await Promise.all([
    prisma.alunoProfile.findMany({
      where,
      include: includeResumo,
      orderBy:
        query.ordenar === "nome" ? { user: { name: "asc" } } : { createdAt: "desc" },
    }),
    prisma.alunoProfile.count({ where }),
    prisma.alunoProfile.count({ where: { personalId } }),
    prisma.alunoProfile.count({ where: { personalId, status: "ATIVO" } }),
  ]);

  const hoje = diaSemanaDe(new Date());

  return {
    alunos: alunos.map((aluno) => toListItem(aluno, hoje)),
    total,
    contagens: { todos, ativos, inativos: todos - ativos },
  };
}

/**
 * Busca um aluno garantindo que ele pertence a este Personal. Retorna `null`
 * quando não existe OU quando é de outro Personal - quem chama responde 404
 * nos dois casos, para não revelar a existência de alunos de terceiros.
 */
export async function obterAluno(
  personalId: string,
  alunoId: string
): Promise<AlunoDetalhe | null> {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    include: {
      ...includeResumo,
      _count: { select: { treinos: true, agendamentos: true, avaliacoes: true } },
      historico: { select: { dataExecucao: true }, orderBy: { dataExecucao: "desc" }, take: 1 },
      agendamentos: {
        where: { data: { gte: new Date() }, status: { in: ["AGENDADO", "REAGENDADO"] } },
        select: { data: true },
        orderBy: { data: "asc" },
        take: 1,
      },
    },
  });

  if (!aluno) return null;

  return {
    ...toListItem(aluno),
    dataNascimento: aluno.dataNascimento?.toISOString() ?? null,
    altura: aluno.altura,
    objetivo: aluno.objetivo,
    observacoes: aluno.observacoes,
    metricas: {
      totalTreinos: aluno._count.treinos,
      treinosAtivos: aluno.treinos.length,
      totalAgendamentos: aluno._count.agendamentos,
      proximoAgendamento: aluno.agendamentos[0]?.data.toISOString() ?? null,
      totalAvaliacoes: aluno._count.avaliacoes,
      ultimaExecucao: aluno.historico[0]?.dataExecucao.toISOString() ?? null,
    },
  };
}

function gerarSenhaTemporaria() {
  // Legível para ditar ao aluno, com entropia suficiente para uso temporário.
  return `Pulse${randomBytes(4).toString("hex").toUpperCase()}!`;
}

export class EmailJaCadastradoError extends Error {
  constructor() {
    super("Este e-mail já está cadastrado.");
    this.name = "EmailJaCadastradoError";
  }
}

/**
 * Cria a conta do aluno (Supabase Auth + `users` + `aluno_profiles`) já
 * vinculada a este Personal. Se a criação no banco falhar, a conta do Auth é
 * removida para não deixar conta órfã.
 */
export async function criarAluno(
  personalId: string,
  input: CriarAlunoInput
): Promise<CriarAlunoResponse> {
  const existente = await prisma.user.findUnique({ where: { email: input.email } });
  if (existente) throw new EmailJaCadastradoError();

  const admin = createAdminClient();
  const senhaTemporaria = gerarSenhaTemporaria();

  const { data: criado, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: senhaTemporaria,
    email_confirm: true,
    app_metadata: { role: "ALUNO" },
    user_metadata: { name: input.name },
  });

  if (error || !criado.user) {
    if (error?.status === 422) throw new EmailJaCadastradoError();
    throw new Error(error?.message ?? "Não foi possível criar a conta do aluno.");
  }

  const userId = criado.user.id;

  try {
    const aluno = await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email: input.email,
          name: input.name,
          role: "ALUNO",
          phone: input.phone || null,
        },
      });

      return tx.alunoProfile.create({
        data: {
          userId,
          personalId,
          dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
          altura: input.altura ?? null,
          objetivo: input.objetivo || null,
          observacoes: input.observacoes || null,
        },
        include: includeResumo,
      });
    });

    return { aluno: toListItem(aluno), senhaTemporaria };
  } catch (err) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw err;
  }
}

/** Atualiza dados do aluno (inclusive status). O e-mail não é editável. */
export async function atualizarAluno(
  personalId: string,
  alunoId: string,
  input: EditarAlunoInput
): Promise<AlunoDetalhe | null> {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true, userId: true },
  });

  if (!aluno) return null;

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.phone !== undefined) {
      await tx.user.update({
        where: { id: aluno.userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        },
      });
    }

    await tx.alunoProfile.update({
      where: { id: aluno.id },
      data: {
        ...(input.dataNascimento !== undefined
          ? { dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null }
          : {}),
        ...(input.altura !== undefined ? { altura: input.altura ?? null } : {}),
        ...(input.objetivo !== undefined ? { objetivo: input.objetivo || null } : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
  });

  return obterAluno(personalId, alunoId);
}
