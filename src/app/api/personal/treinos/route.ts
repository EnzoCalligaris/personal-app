import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { AlunoNaoEncontradoError, criarTreino, listarTreinos } from "@/lib/treinos/queries";
import { criarTreinoSchema, listarTreinosQuerySchema } from "@/lib/validations/treino";

/** Treinos do Personal autenticado, com filtros por aluno, dia e status. */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = listarTreinosQuerySchema.safeParse({
    alunoId: params.get("alunoId") ?? undefined,
    diaSemana: params.get("diaSemana") ?? undefined,
    status: params.get("status") ?? undefined,
    q: params.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const data = await listarTreinos(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json(data);
}

/** Cria um treino vinculado a um aluno do próprio Personal. */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarTreinoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const treino = await criarTreino(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(treino, { status: 201 });
  } catch (error) {
    // Aluno de outro Personal responde 404, como se não existisse.
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao criar treino:", error);
    return NextResponse.json({ error: "Não foi possível criar o treino." }, { status: 500 });
  }
}
