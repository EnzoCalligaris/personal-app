import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { ItemInvalidoError, registrarExecucao, TreinoNaoEncontradoError } from "@/lib/aluno/queries";
import { registrarExecucaoSchema } from "@/lib/validations/aluno-area";

/**
 * Fecha a sessão de treino: grava data, treino, duração e o que foi realizado
 * em cada exercício (séries, repetições e carga).
 */
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
    // Treino de outro aluno responde 404; exercício que não é da ficha, 400.
    if (error instanceof TreinoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ItemInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao registrar execução:", error);
    return NextResponse.json({ error: "Não foi possível registrar." }, { status: 500 });
  }
}
