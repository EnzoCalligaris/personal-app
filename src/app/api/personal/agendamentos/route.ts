import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AlunoNaoEncontradoError,
  ConflitoDeHorarioError,
  criarAgendamento,
  HorarioBloqueadoError,
  PeriodoInvalidoError,
} from "@/lib/agenda/queries";
import { criarAgendamentoSchema } from "@/lib/validations/agenda";

/** Marca um atendimento. O horário precisa estar livre e não bloqueado. */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarAgendamentoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const agendamento = await criarAgendamento(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(agendamento, { status: 201 });
  } catch (error) {
    // Aluno de outro Personal responde 404, como no resto da aplicação.
    if (error instanceof AlunoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflitoDeHorarioError || error instanceof HorarioBloqueadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao criar agendamento:", error);
    return NextResponse.json({ error: "Não foi possível agendar." }, { status: 500 });
  }
}
