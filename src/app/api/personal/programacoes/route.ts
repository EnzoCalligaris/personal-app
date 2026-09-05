import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AlunoNaoEncontradoError,
  criarProgramacao,
  listarProgramacoes,
  PeriodoInvalidoError,
  TreinoInvalidoError,
} from "@/lib/programacoes/queries";
import { criarProgramacaoSchema } from "@/lib/validations/programacao";

/** Programações de um aluno (histórico + a vigente). */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const alunoId = request.nextUrl.searchParams.get("alunoId");
  if (!alunoId) {
    return NextResponse.json({ error: "Informe o aluno (alunoId)." }, { status: 400 });
  }

  try {
    const data = await listarProgramacoes(auth.ctx.personalProfileId!, alunoId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao listar programações:", error);
    return NextResponse.json({ error: "Não foi possível carregar." }, { status: 500 });
  }
}

/** Cria uma programação (encerrando a anterior, se houver sobreposição). */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarProgramacaoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const programacao = await criarProgramacao(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(programacao, { status: 201 });
  } catch (error) {
    if (error instanceof AlunoNaoEncontradoError || error instanceof TreinoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao criar programação:", error);
    return NextResponse.json({ error: "Não foi possível criar a programação." }, { status: 500 });
  }
}
