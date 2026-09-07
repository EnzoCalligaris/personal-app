import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As imagens da aplicação: foto de perfil e demonstração de exercício.
 *
 * O que chega é um arquivo enviado por alguém logado, e nada do que ele diz
 * sobre o próprio arquivo vale como prova: o `Content-Type` e a extensão são
 * escolhidos por quem envia. Quem decide se aquilo é uma imagem é o decodificador,
 * lendo os bytes - e como ele precisa abrir o arquivo de qualquer jeito para
 * redimensionar, a checagem sai de graça no caminho.
 *
 * O caminho no Storage é sempre montado aqui, a partir de ids do servidor.
 * Nome de arquivo enviado pelo cliente não entra na conta em nenhum momento.
 */

/** Teto do que se aceita receber. Depois do preparo, o arquivo fica bem menor. */
export const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB

/** O que a tela oferece no seletor de arquivo. Triagem, não prova. */
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

/** O que o decodificador precisa reconhecer para o arquivo ser aceito. */
const FORMATOS_REAIS = ["jpeg", "png", "webp"];

/**
 * Teto de pixels, independente do tamanho em bytes.
 *
 * Um PNG de poucos KB pode declarar dimensões absurdas e estourar a memória do
 * servidor ao ser decodificado. 40 megapixels passa folgado por qualquer foto
 * de celular e barra o que só existe para derrubar o processo.
 */
const PIXELS_MAXIMOS = 40_000_000;

/** Lado máximo de uma foto de perfil, em pixels. */
export const LADO_AVATAR = 512;

/** Lado máximo da imagem de demonstração de um exercício. */
export const LADO_EXERCICIO = 1024;

/**
 * Triagem barata, antes de ler o arquivo inteiro.
 *
 * Só olha o que o cliente declarou - serve para devolver uma mensagem útil
 * rápido, não para garantir coisa alguma. Quem garante é `prepararImagem`.
 */
export function validarImagem(file: unknown): string | null {
  if (!(file instanceof File)) return "Envie um arquivo no campo 'file'.";
  if (!TIPOS_ACEITOS.includes(file.type)) return "Formato não suportado. Use JPG, PNG ou WebP.";
  if (file.size > TAMANHO_MAXIMO) return "A imagem deve ter no máximo 2 MB.";
  return null;
}

/**
 * O corpo declarado já passa do teto?
 *
 * `Content-Length` vem do cliente e pode mentir - mas quando ele diz a verdade,
 * a requisição é recusada sem que o servidor leia 200 MB para descobrir que não
 * cabiam. O tamanho real ainda é conferido depois, em `validarImagem`.
 */
export function corpoDeclaradoGrandeDemais(request: Request): boolean {
  const declarado = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declarado) || declarado <= 0) return false;

  // O envelope multipart acrescenta algumas centenas de bytes ao arquivo.
  return declarado > TAMANHO_MAXIMO + 64 * 1024;
}

export type ImagemPronta = {
  corpo: Buffer;
  contentType: string;
  extensao: string;
};

export type Preparo = { ok: true; imagem: ImagemPronta } | { ok: false; erro: string };

/**
 * Confere que o arquivo é mesmo uma imagem e devolve a versão que vai ao Storage.
 *
 * A prova é a decodificação: um executável renomeado para `.jpg`, ou um texto
 * enviado com `Content-Type: image/jpeg`, não passa daqui - o decodificador não
 * encontra cabeçalho de imagem nenhum e o pedido é recusado.
 *
 * O que sai é sempre WebP, redimensionado para caber em `ladoMaximo` sem
 * distorcer e sem ampliar o que já era menor. `rotate()` aplica a orientação do
 * EXIF antes de redimensionar, e o resultado sai sem metadado nenhum junto -
 * some a localização de onde a foto foi tirada, que o produto não usa.
 */
export async function prepararImagem(file: File, ladoMaximo: number): Promise<Preparo> {
  const recusa = { ok: false as const, erro: "O arquivo enviado não é uma imagem válida." };

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) return recusa;

  let formato: string | undefined;
  let pixels = 0;

  try {
    const meta = await sharp(bytes).metadata();
    formato = meta.format;
    pixels = (meta.width ?? 0) * (meta.height ?? 0);
  } catch {
    return recusa;
  }

  if (!formato || !FORMATOS_REAIS.includes(formato)) return recusa;
  if (pixels <= 0) return recusa;
  if (pixels > PIXELS_MAXIMOS) {
    return { ok: false, erro: "A imagem tem dimensões grandes demais." };
  }

  try {
    const corpo = await sharp(bytes)
      .rotate()
      .resize({
        width: ladoMaximo,
        height: ladoMaximo,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    return { ok: true, imagem: { corpo, contentType: "image/webp", extensao: "webp" } };
  } catch {
    return recusa;
  }
}

/**
 * Cria o bucket público na primeira vez (idempotente).
 *
 * Roda a cada envio, de propósito: é uma ida à API do Storage numa operação que
 * acontece quando alguém troca a própria foto - raro o bastante para o custo não
 * aparecer. Guardar em memória que o bucket já existe economizaria essa ida e
 * criaria um jeito novo de quebrar: apagado o bucket, a instância continuaria
 * achando que ele está lá.
 */
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
 * Envia a imagem já preparada e devolve a URL pública.
 *
 * O nome inclui um instante para o navegador não servir a versão antiga do
 * cache quando a imagem é trocada, e um sufixo aleatório para que a URL não
 * possa ser deduzida a partir do id (o bucket é público). `pasta` e `nomeBase`
 * vêm sempre do servidor.
 */
export async function enviarImagem({
  bucket,
  pasta,
  nomeBase,
  imagem,
}: {
  bucket: string;
  pasta: string;
  nomeBase: string;
  imagem: ImagemPronta;
}): Promise<string> {
  const admin = createAdminClient();
  await garantirBucket(admin, bucket);

  const sufixo = randomBytes(8).toString("hex");
  const caminho = `${pasta}/${nomeBase}-${Date.now()}-${sufixo}.${imagem.extensao}`;

  const { error } = await admin.storage
    .from(bucket)
    .upload(caminho, imagem.corpo, { contentType: imagem.contentType, upsert: true });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(caminho);

  return publicUrl;
}

/**
 * O caminho dentro do bucket, a partir de uma URL pública do Storage.
 *
 * Devolve `null` para qualquer coisa que não seja uma URL pública **daquele**
 * bucket. É o que impede que um endereço qualquer vire uma ordem de exclusão:
 * outro bucket, outro formato de caminho ou uma tentativa de subir de diretório
 * simplesmente não são reconhecidos.
 */
export function caminhoNoBucket(url: string, bucket: string): string | null {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return null;
  }

  const marca = `/storage/v1/object/public/${bucket}/`;
  const inicio = alvo.pathname.indexOf(marca);
  if (inicio === -1) return null;

  const caminho = decodeURIComponent(alvo.pathname.slice(inicio + marca.length));
  if (!caminho) return null;
  if (caminho.startsWith("/")) return null;
  if (caminho.split("/").some((parte) => parte === "" || parte === "." || parte === "..")) {
    return null;
  }

  return caminho;
}

/**
 * Apaga a imagem que acabou de ser substituída.
 *
 * Só é chamada **depois** de a nova estar no Storage e a referência já apontar
 * para ela: se qualquer um dos dois passos falhar, a antiga continua onde
 * estava e a tela continua mostrando alguma coisa. A URL vem da própria linha do
 * banco que a rota já autorizou - não de quem fez o pedido -, e ainda assim
 * passa por `caminhoNoBucket` antes de virar exclusão.
 *
 * Falhar aqui não derruba a troca: o que sobra é um arquivo esquecido, não uma
 * foto quebrada.
 */
export async function removerImagem(bucket: string, urlAnterior: string | null | undefined) {
  if (!urlAnterior) return;

  const caminho = caminhoNoBucket(urlAnterior, bucket);
  if (!caminho) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(bucket).remove([caminho]);
    if (error) throw error;
  } catch (erro) {
    console.error(`Não foi possível apagar a imagem anterior (${bucket}/${caminho}):`, erro);
  }
}
