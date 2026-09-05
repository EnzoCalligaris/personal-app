import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import {
  AgendamentoNaoEncontradoError,
  AgendamentoRecusadoError,
  editarComoAluno,
  SemPersonalError,
} from "@/lib/aluno/agendamento";
import { editarComoAlunoSchema } from "@/lib/validations/agenda";

/** Cancelar ou reagendar, respeitando o prazo definido pelo Personal. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarComoAlunoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const agendamento = await editarComoAluno(auth.ctx.alunoProfileId!, id, parsed.data);
    return NextResponse.json(agendamento);
  } catch (error) {
    // Agendamento de outro aluno responde 404 - o where já filtra por alunoId.
    if (error instanceof AgendamentoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AgendamentoRecusadoError || error instanceof SemPersonalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao alterar agendamento:", error);
    return NextResponse.json({ error: "Não foi possível alterar." }, { status: 500 });
  }
}
