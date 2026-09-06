import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meusFeedbacks } from "@/lib/aluno/queries";

/** Comentários que o Personal escreveu para este aluno. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const feedbacks = await meusFeedbacks(auth.ctx.alunoProfileId!);
  return NextResponse.json({
    feedbacks,
    naoLidos: feedbacks.filter((feedback) => !feedback.lido).length,
  });
}
