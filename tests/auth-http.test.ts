import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";

const BASE_URL = "http://127.0.0.1:3100";
const SENHA = "Teste@12345";

function cookieHeaderFrom(res: Response): string {
  const cookies = res.headers.getSetCookie();
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { status: res.status, body, cookie: cookieHeaderFrom(res) };
}

function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
}

let personal1: Awaited<ReturnType<typeof createPersonal>>;
let personal2: Awaited<ReturnType<typeof createPersonal>>;
let aluno1: Awaited<ReturnType<typeof createAluno>>;
let aluno2: Awaited<ReturnType<typeof createAluno>>;
let aluno3: Awaited<ReturnType<typeof createAluno>>;

beforeAll(async () => {
  await resetDb();
  personal1 = await createPersonal({ name: "Personal Um" });
  personal2 = await createPersonal({ name: "Personal Dois" });
  aluno1 = await createAluno({ name: "Aluno Um", personalId: personal1.personalProfile.id });
  aluno2 = await createAluno({ name: "Aluno Dois", personalId: personal1.personalProfile.id });
  aluno3 = await createAluno({ name: "Aluno Tres", personalId: personal2.personalProfile.id });
}, 30000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Login", () => {
  it("rejeita senha incorreta", async () => {
    const { status, body } = await login(personal1.user.email, "senha-errada");
    expect(status).toBe(401);
    expect(body.error).toBeTruthy();
  });

  it("autentica com credenciais corretas e retorna a role", async () => {
    const { status, body, cookie } = await login(personal1.user.email, SENHA);
    expect(status).toBe(200);
    expect(body.role).toBe("PERSONAL");
    expect(cookie).toContain("sb-");
  });
});

describe("Acesso autorizado", () => {
  it("Personal vê os próprios dados em /api/me", async () => {
    const { cookie } = await login(personal1.user.email, SENHA);
    const res = await get("/api/me", cookie);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(personal1.user.id);
    expect(body.role).toBe("PERSONAL");
  });

  it("Personal lista somente os alunos vinculados a ele (regra 2)", async () => {
    const { cookie } = await login(personal1.user.email, SENHA);
    const res = await get("/api/personal/alunos", cookie);
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = body.map((a: { id: string }) => a.id).sort();
    expect(ids).toEqual([aluno1.alunoProfile.id, aluno2.alunoProfile.id].sort());
  });

  it("Personal acessa o perfil de um aluno vinculado a ele", async () => {
    const { cookie } = await login(personal1.user.email, SENHA);
    const res = await get(`/api/alunos/${aluno1.alunoProfile.id}`, cookie);
    expect(res.status).toBe(200);
  });

  it("Aluno acessa os próprios dados (regra 1)", async () => {
    const { cookie } = await login(aluno1.user.email, SENHA);
    const res = await get(`/api/alunos/${aluno1.alunoProfile.id}`, cookie);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(aluno1.alunoProfile.id);
  });
});

describe("Acesso não autorizado", () => {
  it("sem sessão: /api/me retorna 401", async () => {
    const res = await get("/api/me");
    expect(res.status).toBe(401);
  });

  it("sem sessão: endpoint administrativo retorna 401 (regra 5)", async () => {
    const res = await get("/api/personal/alunos");
    expect(res.status).toBe(401);
  });

  it("Aluno não acessa endpoint administrativo (regra 3 e 5)", async () => {
    const { cookie } = await login(aluno1.user.email, SENHA);
    const res = await get("/api/personal/alunos", cookie);
    expect(res.status).toBe(403);
  });

  it("Aluno não acessa dados de outro aluno (regra 4)", async () => {
    const { cookie } = await login(aluno1.user.email, SENHA);
    const res = await get(`/api/alunos/${aluno2.alunoProfile.id}`, cookie);
    expect(res.status).toBe(404);
  });

  it("Personal não acessa aluno de outro Personal (regra 2)", async () => {
    const { cookie } = await login(personal1.user.email, SENHA);
    const res = await get(`/api/alunos/${aluno3.alunoProfile.id}`, cookie);
    expect(res.status).toBe(404);
  });

  it("página /personal redireciona para /login quando não autenticado", async () => {
    const res = await fetch(`${BASE_URL}/personal`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("página /personal redireciona um Aluno para /aluno (controle de acesso por role)", async () => {
    const { cookie } = await login(aluno1.user.email, SENHA);
    const res = await fetch(`${BASE_URL}/personal`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/aluno");
  });
});

describe("Logout", () => {
  it("encerra a sessão - requisições seguintes com o mesmo cookie voltam a ser 401", async () => {
    const { cookie } = await login(aluno1.user.email, SENHA);
    expect((await get("/api/me", cookie)).status).toBe(200);

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(logoutRes.status).toBe(200);

    const logoutCookie = cookieHeaderFrom(logoutRes) || cookie;
    const res = await get("/api/me", logoutCookie);
    expect(res.status).toBe(401);
  });
});

describe("Cadastro", () => {
  it("rejeita e-mail já cadastrado", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicado",
        email: personal1.user.email,
        password: "OutraSenha@123",
        role: "PERSONAL",
      }),
    });
    expect(res.status).toBe(409);
  });

  it("cria um novo usuário e já retorna sessão autenticada", async () => {
    const email = `novo-${Date.now()}@example.com`;
    const res = await fetch(`${BASE_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo Aluno", email, password: SENHA, role: "ALUNO" }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.role).toBe("ALUNO");

    const cookie = cookieHeaderFrom(res);
    const me = await get("/api/me", cookie);
    expect(me.status).toBe(200);
  });
});
