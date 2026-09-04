import { NextResponse } from "next/server";
import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

// Endpoint administrativo: exige autenticação + role PERSONAL (regra 5).
// Retorna somente os alunos vinculados a este Personal (regra 2).
export async function GET() {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const alunos = await prisma.alunoProfile.findMany({
    where: { personalId: auth.ctx.personalProfileId! },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(
    alunos.map((aluno) => ({
      id: aluno.id,
      name: aluno.user.name,
      email: aluno.user.email,
      avatarUrl: aluno.user.avatarUrl,
      objetivo: aluno.objetivo,
    }))
  );
}
