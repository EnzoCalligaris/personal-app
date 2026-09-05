import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { AlunoNaoEncontradoError, duplicarTreino } from "@/lib/treinos/queries";
import { duplicarTreinoSchema } from "@/lib/validations/treino";

/** Duplica o treino (mesmo aluno por padrão) com todos os exercícios. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = duplicarTreinoSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const treino = await duplicarTreino(auth.ctx.personalProfileId!, id, parsed.data);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino, { status: 201 });
  } catch (error) {
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao duplicar treino:", error);
    return NextResponse.json({ error: "Não foi possível duplicar o treino." }, { status: 500 });
  }
}
