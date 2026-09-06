import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { enviarImagem, validarImagem } from "@/lib/storage/imagens";

/**
 * Foto do próprio usuário - serve aos dois papéis. O caminho no Storage sai do
 * id da sessão, então ninguém troca a foto de outra pessoa.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const erro = validarImagem(file);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  try {
    const avatarUrl = await enviarImagem({
      bucket: "avatars",
      pasta: auth.ctx.role === "PERSONAL" ? "personais" : "alunos",
      nomeBase: auth.ctx.userId,
      file: file as File,
    });

    await prisma.user.update({ where: { id: auth.ctx.userId }, data: { avatarUrl } });

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Falha ao enviar a foto de perfil:", error);
    return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 500 });
  }
}
