import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { minhaEvolucao } from "@/lib/aluno/queries";

/** Avaliações do próprio aluno, da mais antiga para a mais recente. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const data = await minhaEvolucao(auth.ctx.alunoProfileId!);
  return NextResponse.json(data);
}
