import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}-${randomUUID().slice(0, 8)}`;
}

export async function createPersonal(overrides?: { name?: string }) {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${unique("personal")}@example.com`,
      name: overrides?.name ?? "Personal Trainer Teste",
      role: "PERSONAL",
    },
  });

  const personalProfile = await prisma.personalProfile.create({
    data: { userId: user.id, cref: "000000-G/SP" },
  });

  return { user, personalProfile };
}

export async function createAluno(overrides?: { personalId?: string | null; name?: string }) {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${unique("aluno")}@example.com`,
      name: overrides?.name ?? "Aluno Teste",
      role: "ALUNO",
    },
  });

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
