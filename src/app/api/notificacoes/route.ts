import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { minhasNotificacoes } from "@/lib/notificacoes/queries";

/** Notificações internas do usuário autenticado (Personal ou aluno). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const data = await minhasNotificacoes(auth.ctx.userId);
  return NextResponse.json(data);
}
