import { NextResponse } from "next/server";
import { requireAuth, loadAccessibleAluno } from "@/lib/auth/guards";

// Um Aluno só pode acessar os próprios dados (regra 1); um Personal só pode
// acessar alunos vinculados a ele (regra 2); um Aluno nunca pode ver dados
// de outro aluno (regra 4) - `loadAccessibleAluno` aplica as três checagens
// e devolve 404 (não 403) quando o recurso existe mas não pertence ao ator,
// para não revelar a existência de alunos de terceiros.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const aluno = await loadAccessibleAluno(auth.ctx, id);

  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: aluno.id,
    name: aluno.user.name,
    email: aluno.user.email,
    avatarUrl: aluno.user.avatarUrl,
    dataNascimento: aluno.dataNascimento,
    altura: aluno.altura,
    objetivo: aluno.objetivo,
    personalId: aluno.personalId,
  });
}
