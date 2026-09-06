import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { meuPerfilPersonal, atualizarMeuPerfilPersonal } from "@/lib/personal/perfil";
import { editarMeuPerfilPersonalSchema } from "@/lib/validations/perfil";

export async function GET() {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const perfil = await meuPerfilPersonal(auth.ctx.personalProfileId!);
  if (!perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  return NextResponse.json(perfil);
}

/** O Personal edita os próprios dados. O e-mail de acesso não muda por aqui. */
export async function PATCH(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarMeuPerfilPersonalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const perfil = await atualizarMeuPerfilPersonal(auth.ctx.personalProfileId!, parsed.data);
  if (!perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  return NextResponse.json(perfil);
}
