import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { atualizarAluno, obterAluno } from "@/lib/alunos/queries";
import { editarAlunoSchema } from "@/lib/validations/aluno";

/**
 * Detalhe de um aluno. Responde 404 tanto para "não existe" quanto para
 * "existe, mas é de outro Personal".
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const aluno = await obterAluno(auth.ctx.personalProfileId!, id);

  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  return NextResponse.json(aluno);
}

/** Edita dados do aluno, incluindo ativar/desativar (campo `status`). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarAlunoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;
  const aluno = await atualizarAluno(auth.ctx.personalProfileId!, id, parsed.data);

  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  return NextResponse.json(aluno);
}
