import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { ItemNaoEncontradoError, reordenarExercicios } from "@/lib/treinos/queries";
import { reordenarExerciciosSchema } from "@/lib/validations/treino";

/** Regrava a ordem dos exercícios do treino. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = reordenarExerciciosSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const treino = await reordenarExercicios(auth.ctx.personalProfileId!, id, parsed.data.itens);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino);
  } catch (error) {
    if (error instanceof ItemNaoEncontradoError) {
      return NextResponse.json(
        { error: "A nova ordem precisa conter exatamente os exercícios deste treino." },
        { status: 400 }
      );
    }
    console.error("Falha ao reordenar exercícios:", error);
    return NextResponse.json({ error: "Não foi possível reordenar." }, { status: 500 });
  }
}
