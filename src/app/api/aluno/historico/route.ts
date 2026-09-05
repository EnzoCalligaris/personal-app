import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meuHistorico } from "@/lib/aluno/queries";

/** Histórico de execuções do próprio aluno, com o que foi feito em cada uma. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const data = await meuHistorico(auth.ctx.alunoProfileId!);
  return NextResponse.json(data);
}
