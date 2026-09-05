import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { atualizarItem, ItemNaoEncontradoError, removerItem } from "@/lib/treinos/queries";
import { editarItemTreinoSchema } from "@/lib/validations/treino";

/** Edita séries, repetições, carga, descanso e observações de um exercício. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarItemTreinoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id, itemId } = await params;

  try {
    const treino = await atualizarItem(auth.ctx.personalProfileId!, id, itemId, parsed.data);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino);
  } catch (error) {
    if (error instanceof ItemNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao atualizar exercício do treino:", error);
    return NextResponse.json({ error: "Não foi possível salvar o exercício." }, { status: 500 });
  }
}

/** Remove o exercício do treino e renumera os demais. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id, itemId } = await params;

  try {
    const treino = await removerItem(auth.ctx.personalProfileId!, id, itemId);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino);
  } catch (error) {
    if (error instanceof ItemNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao remover exercício do treino:", error);
    return NextResponse.json({ error: "Não foi possível remover o exercício." }, { status: 500 });
  }
}
