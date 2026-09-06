import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { marcarTodasLidas } from "@/lib/notificacoes/queries";

/** Marca todas as notificações do usuário como lidas. */
export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const marcadas = await marcarTodasLidas(auth.ctx.userId);
  return NextResponse.json({ marcadas });
}
