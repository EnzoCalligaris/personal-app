import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meuTreino } from "@/lib/aluno/queries";

/** Ficha completa. Treino de outro aluno responde 404 (não 403). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const treino = await meuTreino(auth.ctx.alunoProfileId!, id);

  if (!treino) {
    return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
  }

  return NextResponse.json(treino);
}
