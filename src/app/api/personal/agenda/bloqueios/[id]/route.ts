import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { removerBloqueio } from "@/lib/agenda/queries";

/** Liberar o horário: apaga o bloqueio. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const removido = await removerBloqueio(auth.ctx.personalProfileId!, id);

  if (!removido) {
    return NextResponse.json({ error: "Bloqueio não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
