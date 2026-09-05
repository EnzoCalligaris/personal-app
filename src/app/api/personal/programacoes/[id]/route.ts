import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  atualizarProgramacao,
  excluirProgramacao,
  obterProgramacao,
  PeriodoInvalidoError,
} from "@/lib/programacoes/queries";
import { editarProgramacaoSchema } from "@/lib/validations/programacao";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const programacao = await obterProgramacao(auth.ctx.personalProfileId!, id);

  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  return NextResponse.json(programacao);
}

/** Edita nome, período e observações. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarProgramacaoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const programacao = await atualizarProgramacao(auth.ctx.personalProfileId!, id, parsed.data);
    if (!programacao) {
      return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
    }
    return NextResponse.json(programacao);
  } catch (error) {
    if (error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao atualizar programação:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const resultado = await excluirProgramacao(auth.ctx.personalProfileId!, id);

  if (resultado === "nao_encontrada") {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
