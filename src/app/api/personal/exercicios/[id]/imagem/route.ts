import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { enviarImagem, validarImagem } from "@/lib/storage/imagens";

/** Envia a imagem de demonstração do exercício e salva a URL. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const exercicio = await prisma.exercicio.findFirst({
    where: { id, personalId: auth.ctx.personalProfileId! },
    select: { id: true },
  });

  if (!exercicio) {
    return NextResponse.json({ error: "Exercício não encontrado." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  const erro = validarImagem(file);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  try {
    const imagemUrl = await enviarImagem({
      bucket: "exercicios",
      pasta: "demonstracoes",
      nomeBase: exercicio.id,
      file: file as File,
    });

    await prisma.exercicio.update({ where: { id: exercicio.id }, data: { imagemUrl } });

    return NextResponse.json({ imagemUrl });
  } catch (error) {
    console.error("Falha ao enviar a imagem do exercício:", error);
    return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
  }
}
