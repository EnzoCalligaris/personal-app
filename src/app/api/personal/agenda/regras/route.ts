import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { regrasDoPersonal, salvarRegras } from "@/lib/agenda/queries";
import { regrasAgendamentoSchema } from "@/lib/validations/agenda";

/** Regras que o Personal define para o aluno marcar sozinho. */
export async function GET() {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const regras = await regrasDoPersonal(auth.ctx.personalProfileId!);
  return NextResponse.json({ regras });
}

export async function PUT(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = regrasAgendamentoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const regras = await salvarRegras(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json({ regras });
}
