import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AlunoNaoEncontradoError,
  AvaliacaoInvalidaError,
  criarFeedback,
  listarFeedbacks,
} from "@/lib/feedbacks/queries";
import {
  criarFeedbackSchema,
  listarFeedbacksQuerySchema,
} from "@/lib/validations/feedback";

/** Comentários que o Personal escreveu, com filtro por aluno e busca. */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = listarFeedbacksQuerySchema.safeParse({
    alunoId: params.get("alunoId") ?? undefined,
    q: params.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const data = await listarFeedbacks(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const feedback = await criarFeedback(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    // Aluno de outro Personal responde 404, como no resto da aplicação.
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AvaliacaoInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao criar feedback:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
