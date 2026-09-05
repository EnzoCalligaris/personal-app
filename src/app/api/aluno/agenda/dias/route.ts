import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { diasParaAgendar, SemPersonalError } from "@/lib/aluno/agendamento";

/** A janela de dias em que o aluno pode marcar, com os livres de cada um. */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  try {
    const dias = await diasParaAgendar(auth.ctx.alunoProfileId!);
    return NextResponse.json(dias);
  } catch (error) {
    if (error instanceof SemPersonalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao montar a janela de agendamento:", error);
    return NextResponse.json({ error: "Não foi possível carregar." }, { status: 500 });
  }
}
