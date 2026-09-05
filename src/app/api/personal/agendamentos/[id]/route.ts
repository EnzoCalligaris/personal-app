import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  AgendamentoNaoEncontradoError,
  atualizarAgendamento,
  ConflitoDeHorarioError,
  HorarioBloqueadoError,
  PeriodoInvalidoError,
} from "@/lib/agenda/queries";
import { editarAgendamentoSchema } from "@/lib/validations/agenda";

/** Confirmar, cancelar, marcar como realizado ou reagendar. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarAgendamentoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const agendamento = await atualizarAgendamento(auth.ctx.personalProfileId!, id, parsed.data);
    return NextResponse.json(agendamento);
  } catch (error) {
    if (error instanceof AgendamentoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflitoDeHorarioError || error instanceof HorarioBloqueadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao atualizar agendamento:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
