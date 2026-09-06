import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { DiaSemana, StatusAgendamento } from "@/types";
import { createTestAdminClient } from "./supabaseAdmin";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}-${randomUUID().slice(0, 8)}`;
}

const admin = createTestAdminClient();

/**
 * Cria um usuário real no Supabase Auth (necessário: `users.id` tem uma FK
 * para `auth.users.id`) e devolve o id gerado.
 */
async function createAuthUser(email: string, role: "PERSONAL" | "ALUNO", name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Teste@12345",
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name },
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário de teste no Auth (${email}): ${error?.message}`);
  }
  return data.user.id;
}

export async function createPersonal(overrides?: { name?: string }) {
  const name = overrides?.name ?? "Personal Trainer Teste";
  const email = `${unique("personal")}@example.com`;
  const id = await createAuthUser(email, "PERSONAL", name);

  const user = await prisma.user.create({ data: { id, email, name, role: "PERSONAL" } });
  const personalProfile = await prisma.personalProfile.create({
    data: { userId: user.id, cref: "000000-G/SP" },
  });

  return { user, personalProfile };
}

export async function createAluno(overrides?: { personalId?: string | null; name?: string }) {
  const name = overrides?.name ?? "Aluno Teste";
  const email = `${unique("aluno")}@example.com`;
  const id = await createAuthUser(email, "ALUNO", name);

  const user = await prisma.user.create({ data: { id, email, name, role: "ALUNO" } });
  const alunoProfile = await prisma.alunoProfile.create({
    data: {
      userId: user.id,
      personalId: overrides?.personalId ?? null,
      objetivo: "Hipertrofia",
    },
  });

  return { user, alunoProfile };
}

export async function createExercicio(personalId: string, overrides?: { nome?: string }) {
  return prisma.exercicio.create({
    data: {
      personalId,
      nome: overrides?.nome ?? "Supino reto",
      grupoMuscular: "Peito",
    },
  });
}

export async function createTreino(
  personalId: string,
  alunoId: string,
  overrides?: {
    nome?: string;
    ativo?: boolean;
    exercicios?: {
      exercicioId: string;
      ordem: number;
      series: number;
      repeticoes: string;
      carga?: string;
      descansoSeg?: number;
    }[];
  }
) {
  return prisma.treino.create({
    data: {
      personalId,
      alunoId,
      nome: overrides?.nome ?? "Treino de teste",
      ativo: overrides?.ativo ?? true,
      ...(overrides?.exercicios ? { exercicios: { create: overrides.exercicios } } : {}),
    },
  });
}

export async function createFeedback(
  personalId: string,
  alunoId: string,
  overrides?: { texto?: string; avaliacaoId?: string; createdAt?: Date }
) {
  return prisma.feedback.create({
    data: {
      personalId,
      alunoId,
      texto: overrides?.texto ?? "Boa evolução, seguir com o plano.",
      avaliacaoId: overrides?.avaliacaoId ?? null,
      ...(overrides?.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

/** Programação com os dias já montados. */
export async function createProgramacao(
  personalId: string,
  alunoId: string,
  overrides?: {
    nome?: string;
    dataInicio?: Date;
    dataFim?: Date | null;
    dias?: { diaSemana: DiaSemana; treinoId: string }[];
  }
) {
  return prisma.programacao.create({
    data: {
      personalId,
      alunoId,
      nome: overrides?.nome ?? "Programação de teste",
      dataInicio: overrides?.dataInicio ?? new Date(),
      dataFim: overrides?.dataFim ?? null,
      dias: { create: overrides?.dias ?? [] },
    },
    include: { dias: true },
  });
}

export async function createAgendamento(
  personalId: string,
  alunoId: string,
  overrides?: {
    data?: Date;
    horaInicio?: string;
    horaFim?: string;
    status?: StatusAgendamento;
  }
) {
  return prisma.agendamento.create({
    data: {
      personalId,
      alunoId,
      data: overrides?.data ?? new Date(),
      horaInicio: overrides?.horaInicio ?? "08:00",
      horaFim: overrides?.horaFim ?? "09:00",
      status: overrides?.status ?? "AGENDADO",
    },
  });
}

export async function createAvaliacao(
  personalId: string,
  alunoId: string,
  overrides?: { data?: Date; peso?: number; percentualGordura?: number }
) {
  return prisma.avaliacao.create({
    data: {
      personalId,
      alunoId,
      data: overrides?.data ?? new Date(),
      peso: overrides?.peso ?? 70,
      percentualGordura: overrides?.percentualGordura ?? 20,
    },
  });
}

export async function createHistorico(
  treinoId: string,
  alunoId: string,
  overrides?: { dataExecucao?: Date; treinoNome?: string }
) {
  const treino = await prisma.treino.findUnique({ where: { id: treinoId }, select: { nome: true } });
  return prisma.historicoTreino.create({
    data: {
      treinoId,
      treinoNome: overrides?.treinoNome ?? treino?.nome ?? "Treino",
      alunoId,
      dataExecucao: overrides?.dataExecucao ?? new Date(),
      concluido: true,
    },
  });
}

/** Execução registrada, com o que foi feito em cada exercício. */
export async function createExecucao(
  treinoId: string,
  alunoId: string,
  overrides?: {
    dataExecucao?: Date;
    duracaoSeg?: number | null;
    concluido?: boolean;
    observacoes?: string | null;
    itens?: {
      exercicioId?: string | null;
      ordem?: number;
      nome: string;
      grupoMuscular?: string;
      series?: number;
      repeticoes?: string;
      carga?: string | null;
      concluido?: boolean;
    }[];
  }
) {
  const treino = await prisma.treino.findUnique({ where: { id: treinoId }, select: { nome: true } });
  return prisma.historicoTreino.create({
    data: {
      treinoId,
      treinoNome: treino?.nome ?? "Treino",
      alunoId,
      dataExecucao: overrides?.dataExecucao ?? new Date(),
      duracaoSeg: overrides?.duracaoSeg ?? null,
      concluido: overrides?.concluido ?? true,
      observacoes: overrides?.observacoes ?? null,
      itens: {
        create: (overrides?.itens ?? []).map((item, indice) => ({
          exercicioId: item.exercicioId ?? null,
          ordem: item.ordem ?? indice + 1,
          nome: item.nome,
          grupoMuscular: item.grupoMuscular ?? "Peito",
          series: item.series ?? 3,
          repeticoes: item.repeticoes ?? "10",
          carga: item.carga ?? null,
          concluido: item.concluido ?? true,
        })),
      },
    },
    include: { itens: true },
  });
}
