import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { minhaAgenda } from "@/lib/aluno/queries";

/** Agendamentos do próprio aluno (próximos e anteriores). */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const data = await minhaAgenda(auth.ctx.alunoProfileId!);
  return NextResponse.json(data);
}
