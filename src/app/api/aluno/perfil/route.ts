import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import { atualizarMeuPerfil, meuPerfil } from "@/lib/aluno/queries";
import { editarMeuPerfilSchema } from "@/lib/validations/aluno-area";

export async function GET() {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const perfil = await meuPerfil(auth.ctx.alunoProfileId!);
  if (!perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  return NextResponse.json(perfil);
}

/** O aluno edita os próprios dados. E-mail, status e vínculo não entram aqui. */
export async function PATCH(request: NextRequest) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarMeuPerfilSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const perfil = await atualizarMeuPerfil(auth.ctx.alunoProfileId!, parsed.data);
  if (!perfil) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  return NextResponse.json(perfil);
}
