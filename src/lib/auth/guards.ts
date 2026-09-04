import "server-only";
import { NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "./session";
import { prisma } from "@/lib/prisma";

export type GuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/** Exige apenas autenticação (qualquer role). */
export async function requireAuth(): Promise<GuardResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }
  return { ok: true, ctx };
}

/** Exige autenticação + role PERSONAL. Uso: endpoints administrativos. */
export async function requirePersonal(): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (result.ctx.role !== "PERSONAL" || !result.ctx.personalProfileId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Acesso restrito a Personal Trainers." },
        { status: 403 }
      ),
    };
  }
  return result;
}

/** Exige autenticação + role ALUNO. */
export async function requireAluno(): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (result.ctx.role !== "ALUNO" || !result.ctx.alunoProfileId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acesso restrito a alunos." }, { status: 403 }),
    };
  }
  return result;
}

/**
 * Regra de acesso a um Aluno específico (por id de AlunoProfile):
 * - o próprio Aluno pode acessar seus dados;
 * - o Personal só pode acessar alunos vinculados a ele;
 * - qualquer outro caso é negado.
 * Esta é uma checagem pura (não consulta o banco) - o chamador informa o
 * `personalId` do aluno consultado (buscado no banco pelo endpoint).
 */
export function canAccessAluno(
  ctx: AuthContext,
  aluno: { id: string; personalId: string | null }
): boolean {
  if (ctx.role === "ALUNO") {
    return ctx.alunoProfileId === aluno.id;
  }
  if (ctx.role === "PERSONAL") {
    return aluno.personalId !== null && aluno.personalId === ctx.personalProfileId;
  }
  return false;
}

/**
 * Busca um AlunoProfile e aplica `canAccessAluno`. Retorna 404 tanto para
 * "não existe" quanto para "existe mas não é seu" - evita vazar para um
 * Aluno a informação de que outro aluno existe (regra 4).
 */
export async function loadAccessibleAluno(ctx: AuthContext, alunoId: string) {
  const aluno = await prisma.alunoProfile.findUnique({
    where: { id: alunoId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  if (!aluno || !canAccessAluno(ctx, aluno)) {
    return null;
  }

  return aluno;
}
