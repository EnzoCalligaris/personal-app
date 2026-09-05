import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { criarAluno, EmailJaCadastradoError, listarAlunos } from "@/lib/alunos/queries";
import { criarAlunoSchema, listarAlunosQuerySchema } from "@/lib/validations/aluno";

/**
 * Lista os alunos do Personal autenticado, com busca (`q`), filtro de status
 * (`status`) e ordenação (`ordenar`). Endpoint administrativo.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = listarAlunosQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    ordenar: params.get("ordenar") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const data = await listarAlunos(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json(data);
}

/** Cria um aluno já vinculado ao Personal autenticado. */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarAlunoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const resultado = await criarAluno(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof EmailJaCadastradoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao criar aluno:", error);
    return NextResponse.json({ error: "Não foi possível criar o aluno." }, { status: 500 });
  }
}
