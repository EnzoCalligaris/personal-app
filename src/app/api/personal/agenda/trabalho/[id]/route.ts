import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { removerFaixaDeTrabalho } from "@/lib/agenda/queries";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const faixas = await removerFaixaDeTrabalho(auth.ctx.personalProfileId!, id);

  if (!faixas) {
    return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ faixas });
}
