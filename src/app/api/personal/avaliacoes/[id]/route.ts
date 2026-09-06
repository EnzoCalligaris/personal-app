import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  atualizarAvaliacao,
  excluirAvaliacao,
  obterAvaliacao,
} from "@/lib/avaliacoes/queries";
import { editarAvaliacaoSchema } from "@/lib/validations/avaliacao";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const avaliacao = await obterAvaliacao(auth.ctx.personalProfileId!, id);

  if (!avaliacao) {
    return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  }

  return NextResponse.json(avaliacao);
}

/** Corrigir medidas, data ou observações. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarAvaliacaoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;
  const avaliacao = await atualizarAvaliacao(auth.ctx.personalProfileId!, id, parsed.data);

  if (!avaliacao) {
    return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  }

  return NextResponse.json(avaliacao);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const resultado = await excluirAvaliacao(auth.ctx.personalProfileId!, id);

  if (resultado === "nao_encontrada") {
    return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
