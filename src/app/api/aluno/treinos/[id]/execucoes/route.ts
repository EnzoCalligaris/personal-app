import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { registrarExecucao, TreinoNaoEncontradoError } from "@/lib/aluno/queries";
import { registrarExecucaoSchema } from "@/lib/validations/aluno-area";

/** Marca o treino como feito - é o que alimenta o histórico do aluno. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = registrarExecucaoSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const execucao = await registrarExecucao(auth.ctx.alunoProfileId!, id, parsed.data);
    return NextResponse.json(execucao, { status: 201 });
  } catch (error) {
    if (error instanceof TreinoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao registrar execução:", error);
    return NextResponse.json({ error: "Não foi possível registrar." }, { status: 500 });
  }
}
