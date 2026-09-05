import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { adicionarExercicio, ExercicioNaoEncontradoError } from "@/lib/treinos/queries";
import { adicionarExercicioSchema } from "@/lib/validations/treino";

/** Adiciona um exercício da biblioteca ao final do treino. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = adicionarExercicioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const treino = await adicionarExercicio(auth.ctx.personalProfileId!, id, parsed.data);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino, { status: 201 });
  } catch (error) {
    // Exercício de outro Personal responde 404.
    if (error instanceof ExercicioNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao adicionar exercício ao treino:", error);
    return NextResponse.json({ error: "Não foi possível adicionar o exercício." }, { status: 500 });
  }
}
