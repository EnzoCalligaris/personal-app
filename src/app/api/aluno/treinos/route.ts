import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meusTreinos } from "@/lib/aluno/queries";

/** Fichas do próprio aluno + histórico recente de execuções. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const data = await meusTreinos(auth.ctx.alunoProfileId!);
  return NextResponse.json(data);
}
