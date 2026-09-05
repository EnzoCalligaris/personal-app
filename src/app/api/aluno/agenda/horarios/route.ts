import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { horariosParaAgendar, SemPersonalError } from "@/lib/aluno/agendamento";
import { horariosLivresQuerySchema } from "@/lib/validations/agenda";

/** Horários realmente disponíveis para o aluno em uma data. */
export async function GET(request: NextRequest) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const parsed = horariosLivresQuerySchema.safeParse({
    data: request.nextUrl.searchParams.get("data") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe a data (AAAA-MM-DD)." }, { status: 400 });
  }

  try {
    const horarios = await horariosParaAgendar(auth.ctx.alunoProfileId!, parsed.data.data);
    return NextResponse.json(horarios);
  } catch (error) {
    if (error instanceof SemPersonalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao listar horários:", error);
    return NextResponse.json({ error: "Não foi possível carregar." }, { status: 500 });
  }
}
