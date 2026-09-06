import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Percorre todas as telas nos quatro tamanhos de tela e reporta o que não dá
 * para ver numa captura: overflow horizontal (com o elemento culpado), erros
 * de console e alvos de toque pequenos demais no celular.
 *
 * Uso: npm run ui:audit -- [baseUrl] [outDir]
 */

const BASE_URL = process.argv[2] ?? "http://127.0.0.1:3200";
const OUT_DIR = process.argv[3] ?? path.resolve(process.cwd(), ".auditoria-ui");

const TELAS = [
  { nome: "smartphone", width: 390, height: 844, toque: true },
  { nome: "tablet", width: 820, height: 1180, toque: true },
  { nome: "notebook", width: 1280, height: 800, toque: false },
  { nome: "desktop", width: 1920, height: 1080, toque: false },
] as const;

type Achado = {
  tela: string;
  rota: string;
  tipo: "overflow" | "erro" | "alvo";
  detalhe: string;
};

const achados: Achado[] = [];

/* ---------------------------------------------------------------- medições */

/**
 * Roda no navegador: encontra os elementos que ultrapassam a largura da
 * viewport. Ignora quem está dentro de um contêiner com rolagem horizontal
 * própria (tabela larga, faixa de dias) - isso é intencional, não defeito.
 */
const MEDIR_OVERFLOW = `(() => {
  const limite = document.documentElement.clientWidth;
  const documentoVaza = document.documentElement.scrollWidth > limite + 1;

  const rolaSozinho = (el) => {
    let atual = el.parentElement;
    while (atual && atual !== document.documentElement) {
      const estilo = getComputedStyle(atual);
      const rola = estilo.overflowX === "auto" || estilo.overflowX === "scroll";
      if (rola && atual.scrollWidth > atual.clientWidth + 1) return true;
      atual = atual.parentElement;
    }
    return false;
  };

  const culpados = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).position === "fixed") continue;
    if (r.right <= limite + 1) continue;
    if (rolaSozinho(el)) continue;
    culpados.push(el);
  }

  // Só o mais interno de cada cadeia: o pai vaza porque o filho vaza.
  const folhas = culpados.filter((el) => !culpados.some((outro) => outro !== el && el.contains(outro)));

  const descrever = (el) => {
    const classe = typeof el.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 6).join(" ") : "";
    const texto = (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40);
    const r = el.getBoundingClientRect();
    return {
      seletor: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (classe ? "." + classe.replace(/ /g, ".") : ""),
      excesso: Math.round(r.right - limite),
      largura: Math.round(r.width),
      texto,
    };
  };

  return { documentoVaza, largura: limite, rolagem: document.documentElement.scrollWidth, culpados: folhas.slice(0, 6).map(descrever) };
})()`;

/** Botões e links pequenos demais para o dedo. */
const MEDIR_ALVOS = `(() => {
  // Mínimo confortável para o dedo (WCAG 2.5.5 sugere 44px).
  const minimo = 40;
  const pequenos = [];
  for (const el of document.querySelectorAll("button, a[href], [role=button], input[type=checkbox], select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    // Link dentro de um parágrafo é texto, não alvo de toque.
    if (el.tagName === "A" && el.closest("p")) continue;
    if (r.height < minimo || r.width < minimo) {
      const rotulo = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 30);
      pequenos.push({
        seletor: el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""),
        tamanho: Math.round(r.width) + "x" + Math.round(r.height),
        rotulo,
      });
    }
  }
  return pequenos.slice(0, 8);
})()`;

/* ------------------------------------------------------------------ visita */

async function visitar(page: Page, tela: string, rota: string, arquivo: string, medirAlvos: boolean) {
  const erros: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") erros.push(msg.text().slice(0, 160));
  };
  const onPageError = (err: Error) => erros.push(`page error: ${err.message.slice(0, 160)}`);

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    await page.goto(`${BASE_URL}${rota}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500); // deixa a animação de entrada terminar

    const overflow = (await page.evaluate(MEDIR_OVERFLOW)) as {
      documentoVaza: boolean;
      largura: number;
      rolagem: number;
      culpados: { seletor: string; excesso: number; largura: number; texto: string }[];
    };

    if (overflow.documentoVaza) {
      const lista = overflow.culpados
        .map((c) => `      ${c.seletor}  +${c.excesso}px  (largura ${c.largura}px) "${c.texto}"`)
        .join("\n");
      achados.push({
        tela,
        rota,
        tipo: "overflow",
        detalhe: `rola ${overflow.rolagem}px em ${overflow.largura}px\n${lista || "      (culpado não identificado)"}`,
      });
    }

    if (medirAlvos) {
      const pequenos = (await page.evaluate(MEDIR_ALVOS)) as {
        seletor: string;
        tamanho: string;
        rotulo: string;
      }[];
      if (pequenos.length) {
        achados.push({
          tela,
          rota,
          tipo: "alvo",
          detalhe: pequenos.map((p) => `      ${p.seletor} ${p.tamanho} "${p.rotulo}"`).join("\n"),
        });
      }
    }

    await page.screenshot({ path: arquivo, fullPage: true });
  } catch (err) {
    achados.push({ tela, rota, tipo: "erro", detalhe: `      ${(err as Error).message.slice(0, 200)}` });
  } finally {
    if (erros.length) {
      achados.push({ tela, rota, tipo: "erro", detalhe: erros.map((e) => `      ${e}`).join("\n") });
    }
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "Teste@12345");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(personal|aluno)/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function sair(page: Page) {
  await page.request.post(`${BASE_URL}/api/auth/logout`).catch(() => {});
  // Garantia: o cookie é HttpOnly, então limpar o pote é o jeito seguro de
  // não cair no redirecionamento de /login para a área logada.
  await page.context().clearCookies();
}

/**
 * Ids variam a cada seed. Pegamos pelos links da própria página: o cookie de
 * sessão é Secure e o `request` do Playwright (lado Node) não o envia por
 * http - só o navegador abre exceção para 127.0.0.1.
 */
async function primeiroId(page: Page, listagem: string, prefixoDoLink: string) {
  await page.goto(`${BASE_URL}${listagem}`, { waitUntil: "networkidle" });
  const href = await page
    .locator(`a[href^="${prefixoDoLink}"]`)
    .first()
    .getAttribute("href", { timeout: 5000 })
    .catch(() => null);
  return href?.split("/").pop();
}

async function idsDoPersonal(page: Page) {
  const alunoId = await primeiroId(page, "/personal/alunos", "/personal/alunos/");
  const treinoId = await primeiroId(page, "/personal/treinos", "/personal/treinos/");
  console.log(`    ids do Personal: aluno=${alunoId ?? "?"} treino=${treinoId ?? "?"}`);
  return { alunoId, treinoId };
}

async function idsDoAluno(page: Page) {
  const treinoId = await primeiroId(page, "/aluno/treinos", "/aluno/treinos/");
  console.log(`    ids do aluno: treino=${treinoId ?? "?"}`);
  return { treinoId };
}

/* ------------------------------------------------------------------- modais */

/** Modais e gavetas não aparecem numa captura estática da página. */
async function abrirSobreposicoes(page: Page, prefixo: (nome: string) => string, tela: string) {
  const casos = [
    { rota: "/personal/alunos", botao: "Novo aluno", nome: "modal-novo-aluno" },
    { rota: "/personal/exercicios", botao: "Novo exercício", nome: "modal-novo-exercicio" },
    { rota: "/personal/avaliacoes", botao: "Nova avaliação", nome: "modal-nova-avaliacao" },
    { rota: "/personal/agenda", botao: "Novo atendimento", nome: "modal-novo-atendimento" },
  ];

  for (const caso of casos) {
    try {
      await page.goto(`${BASE_URL}${caso.rota}`, { waitUntil: "networkidle" });
      const botao = page.getByRole("button", { name: caso.botao }).first();
      if (!(await botao.isVisible().catch(() => false))) continue;

      await botao.click();
      await page.waitForTimeout(600);

      const overflow = (await page.evaluate(MEDIR_OVERFLOW)) as { documentoVaza: boolean; culpados: unknown[] };
      if (overflow.documentoVaza) {
        achados.push({ tela, rota: `${caso.rota} (${caso.nome})`, tipo: "overflow", detalhe: JSON.stringify(overflow.culpados) });
      }

      await page.screenshot({ path: prefixo(caso.nome), fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    } catch {
      // Botão pode não existir nesta tela - segue.
    }
  }
}

/* -------------------------------------------------------------------- fluxo */

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser: Browser = await chromium.launch();

  try {
    for (const tela of TELAS) {
      console.log(`\n=== ${tela.nome} (${tela.width}x${tela.height}) ===`);

      const context = await browser.newContext({
        viewport: { width: tela.width, height: tela.height },
        deviceScaleFactor: 1,
        isMobile: tela.toque,
        hasTouch: tela.toque,
      });
      const page = await context.newPage();
      const prefixo = (nome: string) => path.join(OUT_DIR, `${tela.nome}-${nome}.png`);
      const eCelular = tela.nome === "smartphone";

      for (const rota of ["/", "/login", "/registro", "/esqueci-senha"]) {
        const nome = rota === "/" ? "landing" : rota.slice(1);
        await visitar(page, tela.nome, rota, prefixo(nome), eCelular);
        console.log(`  ✓ ${rota}`);
      }

      await entrar(page, "personal1@teste.com");
      const doPersonal = await idsDoPersonal(page);

      const rotasPersonal = [
        ["/personal", "personal-inicio"],
        ["/personal/alunos", "personal-alunos"],
        ["/personal/treinos", "personal-treinos"],
        ["/personal/exercicios", "personal-exercicios"],
        ["/personal/agenda", "personal-agenda"],
        ["/personal/avaliacoes", "personal-avaliacoes"],
        ["/personal/perfil", "personal-perfil"],
        ...(doPersonal.alunoId ? [[`/personal/alunos/${doPersonal.alunoId}`, "personal-aluno-detalhe"]] : []),
        ...(doPersonal.treinoId ? [[`/personal/treinos/${doPersonal.treinoId}`, "personal-treino-detalhe"]] : []),
      ] as [string, string][];

      for (const [rota, nome] of rotasPersonal) {
        await visitar(page, tela.nome, rota, prefixo(nome), eCelular);
        console.log(`  ✓ ${rota}`);
      }

      await abrirSobreposicoes(page, prefixo, tela.nome);

      await sair(page);
      await entrar(page, "aluno1@teste.com");
      const doAluno = await idsDoAluno(page);

      const rotasAluno = [
        ["/aluno", "aluno-inicio"],
        ["/aluno/treinos", "aluno-treinos"],
        ["/aluno/agenda", "aluno-agenda"],
        ["/aluno/agenda/agendar", "aluno-agendar"],
        ["/aluno/historico", "aluno-historico"],
        ["/aluno/evolucao", "aluno-evolucao"],
        ["/aluno/feedback", "aluno-feedback"],
        ["/aluno/perfil", "aluno-perfil"],
        ...(doAluno.treinoId
          ? ([
              [`/aluno/treinos/${doAluno.treinoId}`, "aluno-treino-detalhe"],
              [`/aluno/treinos/${doAluno.treinoId}/sessao`, "aluno-sessao"],
            ] as [string, string][])
          : []),
      ] as [string, string][];

      for (const [rota, nome] of rotasAluno) {
        await visitar(page, tela.nome, rota, prefixo(nome), eCelular);
        console.log(`  ✓ ${rota}`);
      }

      await sair(page);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  /* ------------------------------------------------------------ relatório */

  const porTipo = (tipo: Achado["tipo"]) => achados.filter((a) => a.tipo === tipo);

  console.log(`\n\n================ RELATÓRIO ================`);
  for (const tipo of ["overflow", "erro", "alvo"] as const) {
    const lista = porTipo(tipo);
    const titulo = { overflow: "OVERFLOW HORIZONTAL", erro: "ERROS", alvo: "ALVOS DE TOQUE PEQUENOS (celular)" }[tipo];
    console.log(`\n--- ${titulo}: ${lista.length} ---`);
    for (const achado of lista) {
      console.log(`  [${achado.tela}] ${achado.rota}\n${achado.detalhe}`);
    }
  }

  await fs.writeFile(path.join(OUT_DIR, "achados.json"), JSON.stringify(achados, null, 2), "utf8");
  console.log(`\nCapturas em ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
