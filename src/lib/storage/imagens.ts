import "server-only";
import { randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

/** Retorna a mensagem de erro, ou `null` se o arquivo for aceitável. */
export function validarImagem(file: unknown): string | null {
  if (!(file instanceof File)) return "Envie um arquivo no campo 'file'.";
  if (!TIPOS_ACEITOS.includes(file.type)) return "Formato não suportado. Use JPG, PNG ou WebP.";
  if (file.size > TAMANHO_MAXIMO) return "A imagem deve ter no máximo 2 MB.";
  return null;
}

/** Cria o bucket público na primeira vez (idempotente). */
async function garantirBucket(admin: ReturnType<typeof createAdminClient>, bucket: string) {
  const { data } = await admin.storage.getBucket(bucket);
  if (data) return;
  await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: TAMANHO_MAXIMO,
    allowedMimeTypes: TIPOS_ACEITOS,
  });
}

/**
 * Envia uma imagem para o Supabase Storage e devolve a URL pública.
 * O nome inclui um timestamp para o navegador não servir a versão antiga do
 * cache quando a imagem é trocada, e um sufixo aleatório para que a URL não
 * possa ser deduzida a partir do id do aluno (o bucket é público).
 */
export async function enviarImagem({
  bucket,
  pasta,
  nomeBase,
  file,
}: {
  bucket: string;
  pasta: string;
  nomeBase: string;
  file: File;
}): Promise<string> {
  const admin = createAdminClient();
  await garantirBucket(admin, bucket);

  const extensao = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const sufixo = randomBytes(8).toString("hex");
  const caminho = `${pasta}/${nomeBase}-${Date.now()}-${sufixo}.${extensao}`;

  const { error } = await admin.storage
    .from(bucket)
    .upload(caminho, file, { contentType: file.type, upsert: true });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(caminho);

  return publicUrl;
}
