import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AlunoNaoEncontradoError,
  criarAvaliacao,
  listarAvaliacoes,
} from "@/lib/avaliacoes/queries";
import {
  criarAvaliacaoSchema,
  listarAvaliacoesQuerySchema,
} from "@/lib/validations/avaliacao";

/** Avaliações do Personal autenticado, com filtro por aluno e busca por nome. */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = listarAvaliacoesQuerySchema.safeParse({
    alunoId: params.get("alunoId") ?? undefined,
    q: params.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const data = await listarAvaliacoes(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarAvaliacaoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const avaliacao = await criarAvaliacao(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(avaliacao, { status: 201 });
  } catch (error) {
    // Aluno de outro Personal responde 404, como no resto da aplicação.
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao criar avaliação:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
