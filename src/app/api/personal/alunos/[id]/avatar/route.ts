import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

/** Cria o bucket público de avatares na primeira vez (idempotente). */
async function garantirBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: TAMANHO_MAXIMO,
    allowedMimeTypes: TIPOS_ACEITOS,
  });
}

/** Envia a foto do aluno para o Supabase Storage e salva a URL no usuário. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id, personalId: auth.ctx.personalProfileId! },
    select: { id: true, userId: true },
  });

  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo 'file'." }, { status: 400 });
  }

  if (!TIPOS_ACEITOS.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use JPG, PNG ou WebP." },
      { status: 400 }
    );
  }

  if (file.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    await garantirBucket(admin);

    const extensao = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const caminho = `alunos/${aluno.id}-${Date.now()}.${extensao}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(caminho, file, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(caminho);

    await prisma.user.update({ where: { id: aluno.userId }, data: { avatarUrl: publicUrl } });

    return NextResponse.json({ avatarUrl: publicUrl });
  } catch (error) {
    console.error("Falha ao enviar a foto do aluno:", error);
    return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 500 });
  }
}
