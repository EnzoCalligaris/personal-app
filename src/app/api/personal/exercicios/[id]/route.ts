import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  atualizarExercicio,
  ExercicioEmUsoError,
  excluirExercicio,
  NomeDuplicadoError,
  obterExercicio,
} from "@/lib/exercicios/queries";
import { editarExercicioSchema } from "@/lib/validations/exercicio";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const exercicio = await obterExercicio(auth.ctx.personalProfileId!, id);

  if (!exercicio) {
    return NextResponse.json({ error: "Exercício não encontrado." }, { status: 404 });
  }

  return NextResponse.json(exercicio);
}

/** Edita o exercício, incluindo arquivar/restaurar (campo `ativo`). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarExercicioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const exercicio = await atualizarExercicio(auth.ctx.personalProfileId!, id, parsed.data);
    if (!exercicio) {
      return NextResponse.json({ error: "Exercício não encontrado." }, { status: 404 });
    }
    return NextResponse.json(exercicio);
  } catch (error) {
    if (error instanceof NomeDuplicadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao atualizar exercício:", error);
    return NextResponse.json({ error: "Não foi possível salvar o exercício." }, { status: 500 });
  }
}

/** Exclui o exercício - recusa (409) se ele já estiver em algum treino. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const resultado = await excluirExercicio(auth.ctx.personalProfileId!, id);
    if (resultado === "nao_encontrado") {
      return NextResponse.json({ error: "Exercício não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ExercicioEmUsoError) {
      return NextResponse.json({ error: error.message, usos: error.usos }, { status: 409 });
    }
    console.error("Falha ao excluir exercício:", error);
    return NextResponse.json({ error: "Não foi possível excluir o exercício." }, { status: 500 });
  }
}
