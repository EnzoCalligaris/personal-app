import { NextResponse } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { meuDashboard } from "@/lib/aluno/queries";

/**
 * Dashboard do aluno autenticado. O id do perfil vem da sessão - não há
 * parâmetro de aluno em nenhuma rota desta área, logo não há como pedir os
 * dados de outra pessoa.
 */
export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  try {
    const data = await meuDashboard(auth.ctx.alunoProfileId!);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Falha ao montar o dashboard do aluno:", error);
    return NextResponse.json({ error: "Não foi possível carregar seus dados." }, { status: 500 });
  }
}
