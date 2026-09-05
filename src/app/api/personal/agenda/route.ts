import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { agendaDoPeriodo } from "@/lib/agenda/queries";
import { dataUTC, hojeUTC } from "@/lib/date-utils";
import { agendaQuerySchema } from "@/lib/validations/agenda";

/** Agenda do Personal na vista escolhida (dia, semana ou mês). */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = agendaQuerySchema.safeParse({
    vista: params.get("vista") ?? undefined,
    data: params.get("data") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const referencia = parsed.data.data ? dataUTC(parsed.data.data) : hojeUTC();
  const agenda = await agendaDoPeriodo(auth.ctx.personalProfileId!, parsed.data.vista, referencia);

  return NextResponse.json(agenda);
}
