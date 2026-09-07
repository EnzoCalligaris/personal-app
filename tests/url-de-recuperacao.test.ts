import { request } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { urlPublica } from "@/lib/env";
import { resetDb } from "./db";
import { createPersonal } from "./factories";
import { BASE_URL } from "./http";

/**
 * De onde sai o endereço do link de recuperação de senha.
 *
 * Ele era montado com a origem da requisição, e a origem vem do `Host` - um
 * header que quem chama escolhe. Quem pedisse a recuperação da conta alheia com
 * um `Host` forjado faria chegar à caixa da vítima um link para o domínio do
 * atacante, com um token de recuperação válido dentro. Basta a vítima clicar.
 *
 * O caminho `/auth/callback?next=/redefinir-senha` continua o mesmo; o que
 * mudou é a origem, que agora é configuração.
 */

/** O endereço configurado para esta execução - os testes não fixam um valor. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL;

const CAMINHO = "/auth/callback?next=/redefinir-senha";

/** Caixa de e-mail local da stack do Supabase. */
const MAILPIT = "http://127.0.0.1:54324";

let personal: Awaited<ReturnType<typeof createPersonal>>;

/** Roda o corpo com a variável trocada, devolvendo o valor original depois. */
async function comSiteUrl(valor: string | undefined, corpo: () => void | Promise<void>) {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (valor === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = valor;
    await corpo();
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
}

/** Pede a recuperação, mandando os headers de origem que o teste quiser. */
function pedirRecuperacao(email: string, headers: Record<string, string> = {}) {
  return fetch(`${BASE_URL}/api/auth/esqueci-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ email }),
  });
}

/**
 * O mesmo pedido, por HTTP cru.
 *
 * `fetch` recusa definir `Host` - é header proibido pela especificação -, e é
 * justamente o `Host` que era a origem do problema. Por baixo, `node:http`
 * deixa mandar o que se quiser, que é o que um atacante faria.
 */
function pedirComHostForjado(email: string, host: string): Promise<number> {
  const alvo = new URL(BASE_URL);
  const corpo = JSON.stringify({ email });

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: alvo.hostname,
        port: alvo.port,
        path: "/api/auth/esqueci-senha",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(corpo),
          Host: host,
          "X-Forwarded-Host": host,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      }
    );
    req.on("error", reject);
    req.end(corpo);
  });
}

/** O `redirect_to` do link mais recente enviado para o endereço. */
async function destinoDoUltimoEmail(email: string): Promise<string | null> {
  const lista = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await lista.json()) as { messages: { ID: string; Created: string }[] };
  if (!messages?.length) return null;

  const maisNovo = [...messages].sort((a, b) => b.Created.localeCompare(a.Created))[0];
  const detalhe = await fetch(`${MAILPIT}/api/v1/message/${maisNovo.ID}`);
  const { Text } = (await detalhe.json()) as { Text: string };

  const link = Text.match(/https?:\/\/\S*redirect_to=\S+/)?.[0]?.replace(/[)\s]+$/, "");
  if (!link) return null;

  return new URL(link).searchParams.get("redirect_to");
}

beforeAll(async () => {
  await resetDb();
  personal = await createPersonal({ name: "Carlos Recuperacao" });
}, 60000);

afterEach(async () => {
  // O limite de tentativas do passo anterior continua valendo; zerar aqui
  // mantém cada caso independente sem afrouxar nada.
  await prisma.$executeRawUnsafe(`DELETE FROM "rate_limits";`);
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Montagem da URL pública", () => {
  it("junta a origem configurada com o caminho", async () => {
    await comSiteUrl("https://example.com", () => {
      expect(urlPublica(CAMINHO)).toBe(`https://example.com${CAMINHO}`);
    });
  });

  it("barra sobrando no fim não vira barra dobrada", async () => {
    for (const valor of ["https://example.com/", "https://example.com///"]) {
      await comSiteUrl(valor, () => {
        expect(urlPublica(CAMINHO), valor).toBe(`https://example.com${CAMINHO}`);
        expect(urlPublica(CAMINHO), valor).not.toContain("com//auth");
      });
    }
  });

  it("espaço em volta do valor não atrapalha", async () => {
    await comSiteUrl("  https://example.com  ", () => {
      expect(urlPublica(CAMINHO)).toBe(`https://example.com${CAMINHO}`);
    });
  });

  it("preserva um caminho base configurado", async () => {
    await comSiteUrl("https://example.com/app", () => {
      expect(urlPublica(CAMINHO)).toBe(`https://example.com/app${CAMINHO}`);
    });
    await comSiteUrl("https://example.com/app/", () => {
      expect(urlPublica(CAMINHO)).toBe(`https://example.com/app${CAMINHO}`);
    });
  });

  it("porta e protocolo vêm da configuração", async () => {
    await comSiteUrl("http://localhost:3000", () => {
      expect(urlPublica(CAMINHO)).toBe(`http://localhost:3000${CAMINHO}`);
    });
  });

  it("sem a variável, falha dizendo qual é", async () => {
    await comSiteUrl(undefined, () => {
      expect(() => urlPublica(CAMINHO)).toThrow(/NEXT_PUBLIC_SITE_URL/);
    });
  });

  it("com valor inválido, falha em vez de inventar uma URL", async () => {
    for (const invalido of ["", "   ", "example.com", "//example.com", "/apenas/caminho"]) {
      await comSiteUrl(invalido, () => {
        expect(() => urlPublica(CAMINHO), JSON.stringify(invalido)).toThrow(
          /NEXT_PUBLIC_SITE_URL/
        );
      });
    }
  });

  it("recusa protocolo que não seja http ou https", async () => {
    for (const perigoso of ["javascript:alert(1)", "ftp://example.com", "data:text/html,x"]) {
      await comSiteUrl(perigoso, () => {
        expect(() => urlPublica(CAMINHO), perigoso).toThrow(/NEXT_PUBLIC_SITE_URL/);
      });
    }
  });

  it("recusa um caminho que levaria para outro domínio", async () => {
    await comSiteUrl("https://example.com", () => {
      expect(() => urlPublica("//evil.com/auth")).toThrow(/Caminho inválido/);
      expect(() => urlPublica("https://evil.com/auth")).toThrow(/Caminho inválido/);
      expect(() => urlPublica("auth/callback")).toThrow(/Caminho inválido/);
    });
  });
});

describe("O link enviado ignora a origem da requisição", () => {
  /**
   * Este é o teste que importa: passa pela rota de produção, o Supabase gera o
   * e-mail de verdade e a asserção é sobre o link que chegou à caixa.
   */
  it("um Host forjado não muda o destino do link", async () => {
    expect(SITE, "NEXT_PUBLIC_SITE_URL precisa estar definida").toBeTruthy();

    const email = personal.user.email;
    const res = await pedirRecuperacao(email, {
      Host: "attacker.com",
      "X-Forwarded-Host": "outro-atacante.com",
      Origin: "https://mais-um-atacante.com",
    });

    expect(res.status).toBe(200);

    const destino = await destinoDoUltimoEmail(email);
    expect(destino, "o e-mail de recuperação deveria ter chegado").toBeTruthy();

    // O que importa: a origem é a configurada, e nenhum dos domínios enviados
    // pelo cliente aparece.
    expect(destino).toBe(`${SITE}${CAMINHO}`);
    expect(destino).not.toMatch(/attacker\.com|outro-atacante|mais-um-atacante/);
    expect(new URL(destino!).origin).toBe(new URL(SITE!).origin);
  }, 60000);

  it("um Host de verdade forjado, por HTTP cru, também é ignorado", async () => {
    const email = personal.user.email;

    const status = await pedirComHostForjado(email, "attacker.example");
    expect(status).toBe(200);

    const destino = await destinoDoUltimoEmail(email);
    expect(destino).toBe(`${SITE}${CAMINHO}`);
    expect(destino).not.toContain("attacker.example");
  }, 60000);

  it("o caminho de retorno continua sendo o mesmo", async () => {
    const email = personal.user.email;
    await pedirRecuperacao(email);

    const destino = await destinoDoUltimoEmail(email);
    const url = new URL(destino!);

    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/redefinir-senha");
  }, 60000);

  it("as proteções do passo anterior seguem valendo", async () => {
    const email = "quem-nao-existe@example.com";

    // Não revela se a conta existe.
    const inexistente = await pedirRecuperacao(email);
    const existente = await pedirRecuperacao(personal.user.email);
    expect(inexistente.status).toBe(existente.status);
    expect(await inexistente.text()).toBe(await existente.text());

    // E o limite por endereço continua barrando, com Retry-After.
    let ultima = await pedirRecuperacao(email);
    for (let i = 0; i < 3 && ultima.status === 200; i++) {
      ultima = await pedirRecuperacao(email);
    }
    expect(ultima.status).toBe(429);
    expect(Number(ultima.headers.get("retry-after"))).toBeGreaterThan(0);
  }, 60000);
});
