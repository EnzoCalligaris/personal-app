import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, SENHA } from "./http";

/**
 * O menu de conta (nome e avatar, no rodapé da barra lateral ou no topo) é a
 * única entrada para "Meu perfil" e "Sair" no lado do Personal.
 *
 * Este é o único teste da suíte que dirige um navegador: o defeito que ele
 * cobre - `Menu.GroupLabel` sem `Menu.Group` em volta - só aparece quando o
 * menu **monta**, e derruba a árvore React inteira até o boundary de erro.
 * Nenhum teste de HTTP alcança isso, e foi por isso que passou despercebido
 * por várias revisões.
 *
 * A verificação central não é o clique em si: é a ausência de exceção de
 * runtime. Se alguém voltar a usar uma parte de grupo do Base UI fora do
 * grupo, `erros` deixa de estar vazio.
 */

let navegador: Browser;
let personal: Awaited<ReturnType<typeof createPersonal>>;
let aluna: Awaited<ReturnType<typeof createAluno>>;

/** Erros de runtime observados durante a interação. */
type Sessao = { pagina: Page; erros: string[]; fechar: () => Promise<void> };

async function abrirNavegador(largura: number, altura = 900): Promise<Sessao> {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    isMobile: largura < 700,
    hasTouch: largura < 700,
    locale: "pt-BR",
  });
  const pagina = await contexto.newPage();
  const erros: string[] = [];

  pagina.on("pageerror", (erro) => erros.push(erro.message));
  pagina.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  return { pagina, erros, fechar: () => contexto.close() };
}

async function entrar(pagina: Page, email: string) {
  await pagina.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await pagina.fill("#email", email);
  await pagina.fill("#password", SENHA);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/\/(personal|aluno)/, { timeout: 20000 });
  await pagina.waitForLoadState("networkidle");
}

/** Abre o menu de conta e devolve o texto visível da página. */
async function abrirMenuDeConta(pagina: Page) {
  const gatilho = pagina.locator("[data-slot=dropdown-menu-trigger]:visible").first();
  await gatilho.click();
  await pagina.waitForTimeout(600);
  return String(await pagina.evaluate("document.body.innerText"));
}

beforeAll(async () => {
  await resetDb();
  personal = await createPersonal({ name: "Carlos Menu" });
  aluna = await createAluno({ name: "Ana Menu", personalId: personal.personalProfile.id });
  navegador = await chromium.launch();
}, 120000);

afterAll(async () => {
  await navegador?.close();
  await resetDb();
  await prisma.$disconnect();
});

describe("Menu de conta", () => {
  it("abre sem lançar erro de runtime, em toda largura e nos dois papéis", async () => {
    const casos: [string, string, number][] = [
      ["Personal, desktop", personal.user.email, 1440],
      ["Personal, tablet", personal.user.email, 820],
      ["Personal, celular", personal.user.email, 390],
      ["Aluna, desktop", aluna.user.email, 1440],
      ["Aluna, celular", aluna.user.email, 390],
    ];

    for (const [rotulo, email, largura] of casos) {
      const { pagina, erros, fechar } = await abrirNavegador(largura);
      try {
        await entrar(pagina, email);
        const texto = await abrirMenuDeConta(pagina);

        // O menu abriu de fato.
        expect(texto, `${rotulo}: o menu não abriu`).toMatch(/Meu perfil/i);
        expect(texto, `${rotulo}: o menu não abriu`).toMatch(/Sair/i);

        // A página continua de pé - nada de boundary de erro.
        expect(texto, `${rotulo}: a página caiu na tela de erro`).not.toMatch(/Algo deu errado/i);

        // E nenhuma exceção foi lançada. É esta a linha que pega o defeito
        // original: `Base UI error #31` (Menu.GroupLabel fora de Menu.Group).
        expect(erros, `${rotulo}: erro de runtime ao abrir o menu`).toEqual([]);
      } finally {
        await fechar();
      }
    }
  }, 180000);

  it("'Meu perfil' leva à página de perfil do papel", async () => {
    for (const [rotulo, email, destino] of [
      ["Personal", personal.user.email, "/personal/perfil"],
      ["Aluna", aluna.user.email, "/aluno/perfil"],
    ] as [string, string, string][]) {
      const { pagina, erros, fechar } = await abrirNavegador(1440);
      try {
        await entrar(pagina, email);
        await abrirMenuDeConta(pagina);

        await pagina.getByRole("menuitem", { name: /meu perfil/i }).first().click();
        await pagina.waitForURL(new RegExp(destino), { timeout: 15000 });
        await pagina.waitForLoadState("networkidle");

        expect(new URL(pagina.url()).pathname, rotulo).toBe(destino);
        expect(erros, `${rotulo}: erro ao ir para o perfil`).toEqual([]);
      } finally {
        await fechar();
      }
    }
  }, 120000);

  it("'Sair' encerra a sessão e leva ao login", async () => {
    const { pagina, erros, fechar } = await abrirNavegador(1440);
    try {
      await entrar(pagina, personal.user.email);
      await abrirMenuDeConta(pagina);

      await pagina.getByRole("menuitem", { name: /^sair$/i }).first().click();
      await pagina.waitForURL(/\/login/, { timeout: 20000 });

      // A sessão foi mesmo encerrada: a área do Personal volta a redirecionar.
      await pagina.goto(`${BASE_URL}/personal`, { waitUntil: "networkidle" });
      expect(new URL(pagina.url()).pathname).toBe("/login");
      expect(erros, "erro ao sair").toEqual([]);
    } finally {
      await fechar();
    }
  }, 120000);
});
