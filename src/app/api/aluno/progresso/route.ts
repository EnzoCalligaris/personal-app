import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meuProgresso } from "@/lib/aluno/progresso";

/** Evolução dos treinos do próprio aluno: frequência, sequência e cargas. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const data = await meuProgresso(auth.ctx.alunoProfileId!);
  return NextResponse.json(data);
}
