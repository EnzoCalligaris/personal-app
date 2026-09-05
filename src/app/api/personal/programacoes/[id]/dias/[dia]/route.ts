import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { definirDia, removerDia, TreinoInvalidoError } from "@/lib/programacoes/queries";
import { definirDiaSchema, diaSemanaParamSchema } from "@/lib/validations/programacao";

type Params = { params: Promise<{ id: string; dia: string }> };

/** Associa (ou troca) o treino de um dia da semana. */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id, dia } = await params;
  const diaSemana = diaSemanaParamSchema.safeParse(dia.toUpperCase());
  if (!diaSemana.success) {
    return NextResponse.json({ error: "Dia da semana inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = definirDiaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const programacao = await definirDia(
      auth.ctx.personalProfileId!,
      id,
      diaSemana.data,
      parsed.data.treinoId
    );
    if (!programacao) {
      return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
    }
    return NextResponse.json(programacao);
  } catch (error) {
    // Treino de outro Personal ou de outro aluno responde 404.
    if (error instanceof TreinoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Falha ao definir o treino do dia:", error);
    return NextResponse.json({ error: "Não foi possível salvar o dia." }, { status: 500 });
  }
}

/** Remove o treino do dia - o dia passa a ser descanso. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id, dia } = await params;
  const diaSemana = diaSemanaParamSchema.safeParse(dia.toUpperCase());
  if (!diaSemana.success) {
    return NextResponse.json({ error: "Dia da semana inválido." }, { status: 400 });
  }

  const programacao = await removerDia(auth.ctx.personalProfileId!, id, diaSemana.data);
  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  return NextResponse.json(programacao);
}
