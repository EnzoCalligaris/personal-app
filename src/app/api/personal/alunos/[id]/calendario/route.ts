import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { AlunoNaoEncontradoError, calendarioDoAluno } from "@/lib/programacoes/queries";
import { dataUTC, hojeUTC, paraISO, somarDiasUTC } from "@/lib/date-utils";
import { calendarioQuerySchema } from "@/lib/validations/programacao";

/**
 * Calendário de treinos do aluno: o que está previsto em cada data do
 * período. Sem parâmetros, devolve as próximas 4 semanas a partir de hoje.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const hoje = hojeUTC();

  const parsed = calendarioQuerySchema.safeParse({
    de: searchParams.get("de") ?? paraISO(hoje),
    ate: searchParams.get("ate") ?? paraISO(somarDiasUTC(hoje, 27)),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Período inválido." },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const calendario = await calendarioDoAluno(
      auth.ctx.personalProfileId!,
      id,
      dataUTC(parsed.data.de),
      dataUTC(parsed.data.ate)
    );
    return NextResponse.json(calendario);
  } catch (error) {
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao montar o calendário:", error);
    return NextResponse.json({ error: "Não foi possível carregar o calendário." }, { status: 500 });
  }
}
