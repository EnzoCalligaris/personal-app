import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  corpoDeclaradoGrandeDemais,
  enviarImagem,
  prepararImagem,
  removerImagem,
  validarImagem,
  LADO_EXERCICIO,
} from "@/lib/storage/imagens";

/** Envia a imagem de demonstração do exercício e salva a URL. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const exercicio = await prisma.exercicio.findFirst({
    where: { id, personalId: auth.ctx.personalProfileId! },
    select: { id: true, imagemUrl: true },
  });

  if (!exercicio) {
    return NextResponse.json({ error: "Exercício não encontrado." }, { status: 404 });
  }

  if (corpoDeclaradoGrandeDemais(request)) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const erro = validarImagem(file);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  const preparo = await prepararImagem(file as File, LADO_EXERCICIO);
  if (!preparo.ok) return NextResponse.json({ error: preparo.erro }, { status: 400 });

  try {
    const imagemUrl = await enviarImagem({
      bucket: "exercicios",
      pasta: "demonstracoes",
      nomeBase: exercicio.id,
      imagem: preparo.imagem,
    });

    await prisma.exercicio.update({ where: { id: exercicio.id }, data: { imagemUrl } });

    await removerImagem("exercicios", exercicio.imagemUrl);

    return NextResponse.json({ imagemUrl });
  } catch (error) {
    console.error("Falha ao enviar a imagem do exercício:", error);
    return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
  }
}
