import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
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
