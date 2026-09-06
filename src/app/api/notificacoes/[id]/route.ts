import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { marcarNotificacaoLida } from "@/lib/notificacoes/queries";

/** Marca uma notificação como lida. Notificação de outro usuário: 404. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const marcada = await marcarNotificacaoLida(auth.ctx.userId, id);

  if (!marcada) {
    return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
