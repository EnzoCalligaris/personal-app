import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { criarBloqueio, PeriodoInvalidoError } from "@/lib/agenda/queries";
import { criarBloqueioSchema } from "@/lib/validations/agenda";

/** Bloquear um horário (ou o dia inteiro). */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarBloqueioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const bloqueio = await criarBloqueio(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(bloqueio, { status: 201 });
  } catch (error) {
    if (error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Falha ao bloquear horário:", error);
    return NextResponse.json({ error: "Não foi possível bloquear." }, { status: 500 });
  }
}
