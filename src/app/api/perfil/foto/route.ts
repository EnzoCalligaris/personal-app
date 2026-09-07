import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  corpoDeclaradoGrandeDemais,
  enviarImagem,
  prepararImagem,
  removerImagem,
  validarImagem,
  LADO_AVATAR,
} from "@/lib/storage/imagens";

/**
 * Foto do próprio usuário - serve aos dois papéis. O caminho no Storage sai do
 * id da sessão, então ninguém troca a foto de outra pessoa.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (corpoDeclaradoGrandeDemais(request)) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const erro = validarImagem(file);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  // A prova de que é imagem: os bytes precisam decodificar.
  const preparo = await prepararImagem(file as File, LADO_AVATAR);
  if (!preparo.ok) return NextResponse.json({ error: preparo.erro }, { status: 400 });

  try {
    const anterior = await prisma.user.findUnique({
      where: { id: auth.ctx.userId },
      select: { avatarUrl: true },
    });

    const avatarUrl = await enviarImagem({
      bucket: "avatars",
      pasta: auth.ctx.role === "PERSONAL" ? "personais" : "alunos",
      nomeBase: auth.ctx.userId,
      imagem: preparo.imagem,
    });

    await prisma.user.update({ where: { id: auth.ctx.userId }, data: { avatarUrl } });

    // Só agora: a nova está no Storage e o perfil já aponta para ela.
    await removerImagem("avatars", anterior?.avatarUrl);

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Falha ao enviar a foto de perfil:", error);
    return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 500 });
  }
}
