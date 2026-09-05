import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AlunoNaoEncontradoError,
  atualizarTreino,
  excluirTreino,
  obterTreino,
} from "@/lib/treinos/queries";
import { editarTreinoSchema } from "@/lib/validations/treino";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const treino = await obterTreino(auth.ctx.personalProfileId!, id);

  if (!treino) {
    return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
  }

  return NextResponse.json(treino);
}

/** Edita o treino (nome, dia, observações, aluno) e ativa/desativa. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarTreinoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const treino = await atualizarTreino(auth.ctx.personalProfileId!, id, parsed.data);
    if (!treino) {
      return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
    }
    return NextResponse.json(treino);
  } catch (error) {
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao atualizar treino:", error);
    return NextResponse.json({ error: "Não foi possível salvar o treino." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const resultado = await excluirTreino(auth.ctx.personalProfileId!, id);

  if (resultado === "nao_encontrado") {
    return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
