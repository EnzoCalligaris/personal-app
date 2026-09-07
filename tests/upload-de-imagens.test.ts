import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  caminhoNoBucket,
  LADO_AVATAR,
  LADO_EXERCICIO,
  TAMANHO_MAXIMO,
  validarImagem,
} from "@/lib/storage/imagens";
import { resetDb } from "./db";
import { createAluno, createExercicio, createPersonal } from "./factories";
import { BASE_URL, login, SENHA } from "./http";

/**
 * As imagens que entram na aplicação.
 *
 * O que o cliente diz sobre o próprio arquivo não vale como prova: o
 * `Content-Type` e o nome são escolhidos por quem envia. Estes testes mandam
 * arquivos de verdade contra o Storage de verdade da stack local - inclusive
 * arquivos que mentem sobre o que são - e conferem o que ficou guardado.
 */

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let aluna: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluna = "";

/** Uma imagem de verdade, do tamanho e formato pedidos. */
async function imagem(largura: number, altura: number, formato: "jpeg" | "png" | "webp") {
  const base = sharp({
    create: {
      width: largura,
      height: altura,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  });
  return formato === "jpeg"
    ? base.jpeg().toBuffer()
    : formato === "png"
      ? base.png().toBuffer()
      : base.webp().toBuffer();
}

/** Envia um arquivo para a rota, como o navegador faria. */
async function enviar(
  caminho: string,
  cookie: string,
  corpo: Buffer | Uint8Array,
  nome: string,
  tipo: string
) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(corpo)], { type: tipo }), nome);

  return fetch(`${BASE_URL}${caminho}`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

/** Os arquivos que existem hoje no bucket. */
async function objetosDoBucket(bucket: string): Promise<string[]> {
  const linhas = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM storage.objects WHERE bucket_id = $1 ORDER BY name`,
    bucket
  );
  return linhas.map((l) => l.name);
}

/** Baixa a imagem publicada e diz o que ela é de fato. */
async function comoFicou(url: string) {
  const resposta = await fetch(url);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  return { bytes: bytes.byteLength, formato: meta.format, largura: meta.width, altura: meta.height };
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Upload" });
  outroPersonal = await createPersonal({ name: "Marina Rival" });
  aluna = await createAluno({ name: "Ana Upload", personalId: personal.personalProfile.id });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluna = (await login(aluna.user.email, SENHA)).cookie;
}, 120000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("A) Envio válido", () => {
  it("aceita a foto, guarda como WebP e reduz para o tamanho de uso", async () => {
    // Uma foto grande, como sai de um celular.
    const original = await imagem(2400, 1600, "jpeg");

    const res = await enviar("/api/perfil/foto", cookieAluna, original, "foto.jpg", "image/jpeg");
    expect(res.status).toBe(200);

    const { avatarUrl } = (await res.json()) as { avatarUrl: string };
    expect(avatarUrl).toMatch(/^https?:\/\//);

    const guardada = await comoFicou(avatarUrl);
    expect(guardada.formato, "o formato guardado é sempre o mesmo").toBe("webp");
    expect(Math.max(guardada.largura!, guardada.altura!)).toBe(LADO_AVATAR);
    expect(guardada.bytes, "a foto de perfil não guarda megabytes").toBeLessThan(200 * 1024);

    // A proporção original é preservada - nada de esticar o rosto.
    expect(guardada.largura! / guardada.altura!).toBeCloseTo(2400 / 1600, 1);

    // E a referência ficou no banco.
    const dono = await prisma.user.findUnique({ where: { id: aluna.user.id } });
    expect(dono?.avatarUrl).toBe(avatarUrl);
  }, 60000);

  it("a imagem de exercício tem folga maior que a foto de perfil", async () => {
    const exercicio = await createExercicio(personal.personalProfile.id, { nome: "Supino" });
    const original = await imagem(2000, 2000, "png");

    const res = await enviar(
      `/api/personal/exercicios/${exercicio.id}/imagem`,
      cookiePersonal,
      original,
      "supino.png",
      "image/png"
    );
    expect(res.status).toBe(200);

    const { imagemUrl } = (await res.json()) as { imagemUrl: string };
    const guardada = await comoFicou(imagemUrl);

    expect(guardada.formato).toBe("webp");
    expect(Math.max(guardada.largura!, guardada.altura!)).toBe(LADO_EXERCICIO);
  }, 60000);

  it("não amplia quem já era pequeno", async () => {
    const pequena = await imagem(64, 64, "png");

    const res = await enviar("/api/perfil/foto", cookiePersonal, pequena, "p.png", "image/png");
    expect(res.status).toBe(200);

    const { avatarUrl } = (await res.json()) as { avatarUrl: string };
    const guardada = await comoFicou(avatarUrl);
    expect(guardada.largura).toBe(64);
    expect(guardada.altura).toBe(64);
  }, 60000);
});

describe("B/C) Arquivo que mente sobre o que é", () => {
  it("texto enviado como image/jpeg é recusado", async () => {
    const texto = Buffer.from("isto aqui não é uma imagem, é só texto");

    const res = await enviar("/api/perfil/foto", cookieAluna, texto, "foto.jpg", "image/jpeg");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/não é uma imagem/i);
  }, 60000);

  it("executável com extensão .png e Content-Type de imagem é recusado", async () => {
    // Cabeçalho de um ELF - um binário qualquer com nome de imagem.
    const binario = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, ...Array(64).fill(0)]);

    const res = await enviar("/api/perfil/foto", cookieAluna, binario, "inocente.png", "image/png");

    expect(res.status).toBe(400);
  }, 60000);

  it("um SVG com script dentro não passa por imagem", async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`
    );

    const res = await enviar("/api/perfil/foto", cookieAluna, svg, "x.png", "image/png");

    expect(res.status).toBe(400);
  }, 60000);

  it("uma imagem de verdade com extensão trocada continua valendo", async () => {
    // O que importa são os bytes: um PNG chamado .jpg é um PNG.
    const png = await imagem(300, 300, "png");

    const res = await enviar("/api/perfil/foto", cookieAluna, png, "disfarcado.jpg", "image/jpeg");

    expect(res.status).toBe(200);
  }, 60000);
});

describe("D) Tamanho", () => {
  it("recusa o corpo grande antes de lê-lo inteiro", async () => {
    const enorme = new Uint8Array(3 * 1024 * 1024);

    const res = await enviar("/api/perfil/foto", cookieAluna, enorme, "grande.jpg", "image/jpeg");

    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/2 MB/);
  }, 60000);

  it("a conferência do tamanho real também existe", () => {
    const grande = new File([new Uint8Array(TAMANHO_MAXIMO + 1)], "g.jpg", { type: "image/jpeg" });
    expect(validarImagem(grande)).toMatch(/2 MB/);

    const cabe = new File([new Uint8Array(1024)], "ok.jpg", { type: "image/jpeg" });
    expect(validarImagem(cabe)).toBeNull();
  });
});

describe("E/F/G) Substituição e o arquivo antigo", () => {
  it("a nova entra, a antiga sai - e só depois de a nova estar segura", async () => {
    const antes = await enviar(
      "/api/perfil/foto",
      cookieAluna,
      await imagem(400, 400, "jpeg"),
      "1.jpg",
      "image/jpeg"
    );
    const { avatarUrl: primeira } = (await antes.json()) as { avatarUrl: string };
    const caminhoPrimeira = caminhoNoBucket(primeira, "avatars")!;
    expect(await objetosDoBucket("avatars")).toContain(caminhoPrimeira);

    // Uma troca que falha não pode levar a foto que está lá.
    const invalida = await enviar(
      "/api/perfil/foto",
      cookieAluna,
      Buffer.from("nem imagem é"),
      "2.jpg",
      "image/jpeg"
    );
    expect(invalida.status).toBe(400);
    expect(await objetosDoBucket("avatars"), "a antiga sobrevive à troca falha").toContain(
      caminhoPrimeira
    );
    const intacta = await prisma.user.findUnique({ where: { id: aluna.user.id } });
    expect(intacta?.avatarUrl).toBe(primeira);

    // Agora uma troca que dá certo.
    const depois = await enviar(
      "/api/perfil/foto",
      cookieAluna,
      await imagem(500, 500, "png"),
      "3.png",
      "image/png"
    );
    const { avatarUrl: segunda } = (await depois.json()) as { avatarUrl: string };
    expect(segunda).not.toBe(primeira);

    const guardados = await objetosDoBucket("avatars");
    expect(guardados, "a nova está lá").toContain(caminhoNoBucket(segunda, "avatars")!);
    expect(guardados, "a antiga saiu").not.toContain(caminhoPrimeira);

    // E a nova continua acessível.
    expect((await fetch(segunda)).status).toBe(200);
  }, 120000);

  it("trocar a imagem do exercício também não deixa a antiga para trás", async () => {
    const exercicio = await createExercicio(personal.personalProfile.id, { nome: "Agachamento" });
    const rota = `/api/personal/exercicios/${exercicio.id}/imagem`;

    const um = await enviar(rota, cookiePersonal, await imagem(300, 300, "jpeg"), "a.jpg", "image/jpeg");
    const { imagemUrl: primeira } = (await um.json()) as { imagemUrl: string };

    const dois = await enviar(rota, cookiePersonal, await imagem(300, 300, "jpeg"), "b.jpg", "image/jpeg");
    const { imagemUrl: segunda } = (await dois.json()) as { imagemUrl: string };

    const guardados = await objetosDoBucket("exercicios");
    expect(guardados).toContain(caminhoNoBucket(segunda, "exercicios")!);
    expect(guardados).not.toContain(caminhoNoBucket(primeira, "exercicios")!);
  }, 120000);
});

describe("H/J) Quem pode enviar", () => {
  it("sem sessão, ninguém envia nada", async () => {
    const foto = await imagem(100, 100, "png");

    expect((await enviar("/api/perfil/foto", "", foto, "x.png", "image/png")).status).toBe(401);
    expect(
      (
        await enviar(
          `/api/personal/alunos/${aluna.alunoProfile.id}/avatar`,
          "",
          foto,
          "x.png",
          "image/png"
        )
      ).status
    ).toBe(401);
  }, 60000);

  it("o Personal não mexe na foto do aluno de outro Personal", async () => {
    const res = await enviar(
      `/api/personal/alunos/${aluna.alunoProfile.id}/avatar`,
      cookieOutroPersonal,
      await imagem(100, 100, "png"),
      "x.png",
      "image/png"
    );

    // 404: nem confirma que o aluno existe.
    expect(res.status).toBe(404);
  }, 60000);

  it("o aluno não usa a rota do Personal", async () => {
    const exercicio = await createExercicio(personal.personalProfile.id, { nome: "Remada" });

    const res = await enviar(
      `/api/personal/exercicios/${exercicio.id}/imagem`,
      cookieAluna,
      await imagem(100, 100, "png"),
      "x.png",
      "image/png"
    );

    expect(res.status).toBe(403);
  }, 60000);

  it("o Personal troca a foto do próprio aluno, e ela vai para o aluno certo", async () => {
    const res = await enviar(
      `/api/personal/alunos/${aluna.alunoProfile.id}/avatar`,
      cookiePersonal,
      await imagem(300, 300, "jpeg"),
      "aluna.jpg",
      "image/jpeg"
    );
    expect(res.status).toBe(200);

    const { avatarUrl } = (await res.json()) as { avatarUrl: string };
    const dona = await prisma.user.findUnique({ where: { id: aluna.user.id } });
    expect(dona?.avatarUrl).toBe(avatarUrl);

    // E ninguém mais foi afetado.
    const intocado = await prisma.user.findUnique({ where: { id: personal.user.id } });
    expect(intocado?.avatarUrl).not.toBe(avatarUrl);
  }, 60000);
});

describe("I) O caminho que vira exclusão", () => {
  /**
   * A URL da imagem anterior sai da linha do banco que a rota já autorizou,
   * nunca de quem fez o pedido. Ainda assim, ela passa por aqui antes de virar
   * uma exclusão - e nada que não seja uma URL pública daquele bucket é
   * reconhecido.
   */
  it("reconhece o caminho de uma URL pública do bucket", () => {
    expect(
      caminhoNoBucket(
        "http://127.0.0.1:54321/storage/v1/object/public/avatars/alunos/abc-1-2.webp",
        "avatars"
      )
    ).toBe("alunos/abc-1-2.webp");
  });

  it("recusa qualquer outra coisa", () => {
    const recusadas = [
      // Outro bucket.
      "http://127.0.0.1:54321/storage/v1/object/public/exercicios/demonstracoes/x.webp",
      // Subir de diretório.
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/../exercicios/x.webp",
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/alunos/../../x.webp",
      // Codificado, para escapar de uma checagem ingênua de texto.
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/%2e%2e/x.webp",
      // Sem caminho nenhum.
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/",
      // Nem é URL do Storage.
      "https://exemplo.com/qualquer/coisa.webp",
      "https://exemplo.com/storage/v1/object/public/avatars-falso/x.webp",
      // Nem é URL.
      "avatars/alunos/x.webp",
      "",
    ];

    for (const url of recusadas) {
      expect(caminhoNoBucket(url, "avatars"), url).toBeNull();
    }
  });
});
