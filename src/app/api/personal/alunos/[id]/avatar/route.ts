import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  corpoDeclaradoGrandeDemais,
  enviarImagem,
  prepararImagem,
  removerImagem,
  validarImagem,
  LADO_AVATAR,
} from "@/lib/storage/imagens";

/** Envia a foto do aluno para o Supabase Storage e salva a URL no usuário. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id, personalId: auth.ctx.personalProfileId! },
    select: { id: true, userId: true, user: { select: { avatarUrl: true } } },
  });

  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  if (corpoDeclaradoGrandeDemais(request)) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const erro = validarImagem(file);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const preparo = await prepararImagem(file as File, LADO_AVATAR);
  if (!preparo.ok) return NextResponse.json({ error: preparo.erro }, { status: 400 });

  try {
    const avatarUrl = await enviarImagem({
      bucket: "avatars",
      pasta: "alunos",
      nomeBase: aluno.id,
      imagem: preparo.imagem,
    });

    await prisma.user.update({ where: { id: aluno.userId }, data: { avatarUrl } });

    // A URL anterior sai da linha que esta rota já autorizou.
    await removerImagem("avatars", aluno.user.avatarUrl);

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Falha ao enviar a foto do aluno:", error);
    return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 500 });
  }
}
