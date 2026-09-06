import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { marcarFeedbacksLidos } from "@/lib/aluno/queries";

/** O aluno abriu a tela de feedback: marca os comentários como lidos. */
export async function POST() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const marcados = await marcarFeedbacksLidos(auth.ctx.alunoProfileId!, auth.ctx.userId);
  return NextResponse.json({ marcados });
}
