import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Captura a aplicação em mobile, tablet e desktop (tema claro e escuro) para
 * conferir a responsividade da fundação visual.
 *
 * Uso: npm run screenshots -- [baseUrl] [outDir]
 */

const BASE_URL = process.argv[2] ?? "http://127.0.0.1:3200";
const OUT_DIR = process.argv[3] ?? path.resolve(process.cwd(), ".screenshots");

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, isMobile: true },
  { name: "tablet", width: 820, height: 1180, isMobile: true },
  { name: "desktop", width: 1440, height: 900, isMobile: false },
] as const;

const PUBLIC_PAGES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "registro", path: "/registro" },
  { name: "design-system", path: "/design-system" },
];

const PERSONAL_PAGES = [
  { name: "personal-overview", path: "/personal" },
  { name: "personal-alunos", path: "/personal/alunos" },
];

const ALUNO_PAGES = [{ name: "aluno-home", path: "/aluno" }];

async function shot(page: Page, url: string, file: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  // Deixa as animações de entrada terminarem antes de capturar.
  await page.waitForTimeout(450);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ ${path.basename(file)}`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(personal|aluno)/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

/** Abre o modal e dispara um toast no design system, capturando cada estado. */
async function captureInteractions(page: Page, prefix: (name: string) => string) {
  await page.goto(`${BASE_URL}/design-system`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Abrir modal" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: prefix("modal"), fullPage: false });
  console.log(`  ✓ ${path.basename(prefix("modal"))}`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Toast sucesso" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: prefix("toast"), fullPage: false });
  console.log(`  ✓ ${path.basename(prefix("toast"))}`);
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser: Browser = await chromium.launch();

  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of ["light", "dark"] as const) {
        console.log(`\n${viewport.name} (${viewport.width}x${viewport.height}) · tema ${theme}`);

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 2,
          isMobile: viewport.isMobile,
          hasTouch: viewport.isMobile,
          colorScheme: theme,
        });
        // next-themes lê a preferência do localStorage.
        await context.addInitScript(`window.localStorage.setItem("theme", "${theme}")`);

        const page = await context.newPage();
        const prefix = (name: string) =>
          path.join(OUT_DIR, `${viewport.name}-${theme}-${name}.png`);

        for (const target of PUBLIC_PAGES) {
          await shot(page, `${BASE_URL}${target.path}`, prefix(target.name));
        }

        await login(page, "personal1@teste.com", "Teste@12345");
        for (const target of PERSONAL_PAGES) {
          await shot(page, `${BASE_URL}${target.path}`, prefix(target.name));
        }

        // Personal sem dados: mostra os estados vazios do dashboard.
        await page.request.post(`${BASE_URL}/api/auth/logout`);
        await login(page, "personal2@teste.com", "Teste@12345");
        await shot(page, `${BASE_URL}/personal`, prefix("personal-overview-vazio"));

        await page.request.post(`${BASE_URL}/api/auth/logout`);
        await login(page, "aluno1@teste.com", "Teste@12345");
        for (const target of ALUNO_PAGES) {
          await shot(page, `${BASE_URL}${target.path}`, prefix(target.name));
        }

        // Estados interativos (modal e toast) não aparecem numa captura estática.
        await captureInteractions(page, prefix);

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nScreenshots salvos em ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
