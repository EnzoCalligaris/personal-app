import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { canAccessAluno, loadAccessibleAluno } from "@/lib/auth/guards";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";

function ctxFor(overrides: Partial<AuthContext>): AuthContext {
  return {
    userId: "user-x",
    email: "x@example.com",
    name: "X",
    role: "ALUNO",
    personalProfileId: null,
    alunoProfileId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("canAccessAluno (regra pura, sem I/O)", () => {
  it("permite que o próprio Aluno acesse seus dados (regra 1)", () => {
    const ctx = ctxFor({ role: "ALUNO", alunoProfileId: "aluno-1" });
    expect(canAccessAluno(ctx, { id: "aluno-1", personalId: "personal-1" })).toBe(true);
  });

  it("nega que um Aluno acesse dados de outro aluno (regra 4)", () => {
    const ctx = ctxFor({ role: "ALUNO", alunoProfileId: "aluno-1" });
    expect(canAccessAluno(ctx, { id: "aluno-2", personalId: "personal-1" })).toBe(false);
  });

  it("permite que o Personal acesse um aluno vinculado a ele (regra 2)", () => {
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: "personal-1" });
    expect(canAccessAluno(ctx, { id: "aluno-1", personalId: "personal-1" })).toBe(true);
  });

  it("nega que o Personal acesse um aluno de outro Personal (regra 2)", () => {
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: "personal-1" });
    expect(canAccessAluno(ctx, { id: "aluno-1", personalId: "personal-2" })).toBe(false);
  });

  it("nega acesso a aluno sem personal vinculado, mesmo para um Personal", () => {
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: "personal-1" });
    expect(canAccessAluno(ctx, { id: "aluno-1", personalId: null })).toBe(false);
  });
});

describe("loadAccessibleAluno (integração real com o banco)", () => {
  it("Aluno consegue carregar o próprio perfil", async () => {
    const { alunoProfile } = await createAluno();
    const ctx = ctxFor({ role: "ALUNO", alunoProfileId: alunoProfile.id });

    const result = await loadAccessibleAluno(ctx, alunoProfile.id);
    expect(result?.id).toBe(alunoProfile.id);
  });

  it("Aluno não consegue carregar o perfil de outro aluno (retorna null, não lança erro)", async () => {
    const { alunoProfile: aluno1 } = await createAluno({ name: "Aluno 1" });
    const { alunoProfile: aluno2 } = await createAluno({ name: "Aluno 2" });
    const ctx = ctxFor({ role: "ALUNO", alunoProfileId: aluno1.id });

    const result = await loadAccessibleAluno(ctx, aluno2.id);
    expect(result).toBeNull();
  });

  it("Personal consegue carregar um aluno vinculado a ele", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: personalProfile.id });

    const result = await loadAccessibleAluno(ctx, alunoProfile.id);
    expect(result?.id).toBe(alunoProfile.id);
  });

  it("Personal não consegue carregar um aluno de outro Personal", async () => {
    const { personalProfile: personalA } = await createPersonal({ name: "Personal A" });
    const { personalProfile: personalB } = await createPersonal({ name: "Personal B" });
    const { alunoProfile } = await createAluno({ personalId: personalB.id });
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: personalA.id });

    const result = await loadAccessibleAluno(ctx, alunoProfile.id);
    expect(result).toBeNull();
  });

  it("retorna null para um id de aluno inexistente", async () => {
    const { personalProfile } = await createPersonal();
    const ctx = ctxFor({ role: "PERSONAL", personalProfileId: personalProfile.id });

    const result = await loadAccessibleAluno(ctx, "00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});
