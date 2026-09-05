import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { horariosLivres } from "@/lib/agenda/queries";
import { horariosLivresQuerySchema } from "@/lib/validations/agenda";

/** Horários livres de um dia, gerados pelos horários de trabalho. */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const parsed = horariosLivresQuerySchema.safeParse({
    data: request.nextUrl.searchParams.get("data") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe a data (AAAA-MM-DD)." }, { status: 400 });
  }

  const livres = await horariosLivres(auth.ctx.personalProfileId!, parsed.data.data);
  return NextResponse.json(livres);
}
