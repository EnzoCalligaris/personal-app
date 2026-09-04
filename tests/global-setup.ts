import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Invocado diretamente via `node <bin>` (sem npx/shell) para que o processo
// filho seja único e `child.kill()` realmente o encerre no Windows.
const NEXT_BIN = path.resolve(process.cwd(), "node_modules/next/dist/bin/next");

async function waitForServer(url: string, timeoutMs: number) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    `Servidor de teste não respondeu em ${url} dentro de ${timeoutMs}ms: ${String(lastError)}`
  );
}

export default async function setup() {
  // `next dev` usa um lock por projeto (não por porta) - com um dev server
  // já rodando (uso manual em :3000), um segundo `next dev` recusa iniciar.
  // Por isso os testes sobem um servidor de produção (`next start`) dedicado.
  const build = spawnSync(process.execPath, [NEXT_BIN, "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (build.status !== 0) {
    throw new Error("`next build` falhou - não é possível subir o servidor de teste.");
  }

  const child: ChildProcess = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-p", String(PORT), "-H", "127.0.0.1"],
    { cwd: process.cwd(), stdio: "pipe" }
  );

  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(BASE_URL, 45000);
  } catch (err) {
    child.kill();
    throw new Error(`${(err as Error).message}\n--- saída do servidor ---\n${output}`);
  }

  return async () => {
    child.kill();
  };
}
