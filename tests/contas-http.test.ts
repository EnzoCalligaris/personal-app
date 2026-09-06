import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";
import { createTestAdminClient } from "./supabaseAdmin";

/**
 * Ciclo de vida da conta: cadastro, entrada, troca de senha e a origem da
 * role. Os demais arquivos partem de usuários já prontos pelas factories -
 * aqui os fluxos são exercitados pela porta da frente.
 */

const admin = createTestAdminClient();

function emailNovo(prefixo: string) {
  return `${prefixo}-${randomUUID().slice(0, 8)}@example.com`;
}

function post(caminho: string, corpo: unknown, cookie?: string) {
  return fetch(`${BASE_URL}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(corpo),
  });
}

function cookieDe(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

beforeAll(async () => {
  await resetDb();
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Cadastro - validação", () => {
  it("recusa nome curto, e-mail inválido, senha curta e role desconhecida", async () => {
    const casos = [
      { name: "A", email: emailNovo("v1"), password: "SenhaBoa@123", role: "PERSONAL" },
      { name: "Nome Completo", email: "sem-arroba", password: "SenhaBoa@123", role: "PERSONAL" },
      { name: "Nome Completo", email: emailNovo("v3"), password: "curta", role: "PERSONAL" },
      { name: "Nome Completo", email: emailNovo("v4"), password: "SenhaBoa@123", role: "ADMIN" },
      { name: "Nome Completo", email: emailNovo("v5"), password: "SenhaBoa@123" },
    ];

    for (const corpo of casos) {
      const res = await post("/api/auth/registro", corpo);
      expect(res.status, JSON.stringify(corpo)).toBe(400);
    }

    // Nenhuma conta ficou para trás no Auth nem no banco.
    for (const corpo of casos) {
      expect(await prisma.user.findUnique({ where: { email: corpo.email } })).toBeNull();
    }
  });

  it("aceita exatamente 8 caracteres de senha", async () => {
    const email = emailNovo("oito");
    const res = await post("/api/auth/registro", {
      name: "Senha Curtinha",
      email,
      password: "12345678",
      role: "ALUNO",
    });

    expect(res.status).toBe(201);
    expect((await login(email, "12345678")).status).toBe(200);
  });

  it("recusa corpo que não é JSON", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{{",
    });
    expect(res.status).toBe(400);
  });
});

describe("Cadastro - criação da conta", () => {
  it("cria um Personal com perfil e já devolve sessão válida", async () => {
    const email = emailNovo("novo-personal");
    const res = await post("/api/auth/registro", {
      name: "Novo Personal",
      email,
      password: "SenhaBoa@123",
      role: "PERSONAL",
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.role).toBe("PERSONAL");
    expect(body.autoLogin).toBe(true);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { personalProfile: true, alunoProfile: true },
    });
    expect(usuario.role).toBe("PERSONAL");
    expect(usuario.personalProfile).not.toBeNull();
    expect(usuario.alunoProfile).toBeNull();

    // A sessão devolvida no cadastro já abre a área do Personal.
    const cookie = cookieDe(res);
    const me = await (await get("/api/me", cookie)).json();
    expect(me.role).toBe("PERSONAL");
    expect((await get("/api/personal/alunos", cookie)).status).toBe(200);
  });

  it("cria um Aluno com perfil, ainda sem Personal vinculado", async () => {
    const email = emailNovo("novo-aluno");
    const res = await post("/api/auth/registro", {
      name: "Novo Aluno",
      email,
      password: "SenhaBoa@123",
      role: "ALUNO",
    });

    expect(res.status).toBe(201);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { alunoProfile: true, personalProfile: true },
    });
    expect(usuario.role).toBe("ALUNO");
    expect(usuario.personalProfile).toBeNull();
    expect(usuario.alunoProfile?.personalId).toBeNull();

    // Entra na própria área, mesmo sem Personal.
    const cookie = cookieDe(res);
    expect((await get("/api/aluno/dashboard", cookie)).status).toBe(200);
    expect((await get("/api/personal/alunos", cookie)).status).toBe(403);
  });

  it("ignora campos que não são do cadastro", async () => {
    const outro = await createPersonal({ name: "Personal Existente" });
    const email = emailNovo("intruso");

    const res = await post("/api/auth/registro", {
      name: "Aluno Intruso",
      email,
      password: "SenhaBoa@123",
      role: "ALUNO",
      // Tentativa de já nascer vinculado (e com id escolhido).
      personalId: outro.personalProfile.id,
      id: randomUUID(),
      status: "INATIVO",
    });
    expect(res.status).toBe(201);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { alunoProfile: true },
    });
    expect(usuario.alunoProfile?.personalId).toBeNull();
    expect(usuario.alunoProfile?.status).toBe("ATIVO");
  });

  it("recusa e-mail já cadastrado, sem duplicar a conta", async () => {
    const email = emailNovo("repetido");
    const primeiro = await post("/api/auth/registro", {
      name: "Primeiro Dono",
      email,
      password: "SenhaBoa@123",
      role: "PERSONAL",
    });
    expect(primeiro.status).toBe(201);

    const segundo = await post("/api/auth/registro", {
      name: "Segundo Dono",
      email,
      password: "OutraSenha@123",
      role: "ALUNO",
    });
    expect(segundo.status).toBe(409);

    const usuarios = await prisma.user.findMany({ where: { email } });
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].name).toBe("Primeiro Dono");
    // E a senha continua sendo a do primeiro cadastro.
    expect((await login(email, "OutraSenha@123")).status).toBe(401);
    expect((await login(email, "SenhaBoa@123")).status).toBe(200);
  });
});

describe("Login", () => {
  let personal: Awaited<ReturnType<typeof createPersonal>>;

  beforeAll(async () => {
    personal = await createPersonal({ name: "Carlos Login" });
  });

  it("separa corpo inválido (400) de credencial errada (401)", async () => {
    expect((await post("/api/auth/login", { email: "sem-arroba", password: "x" })).status).toBe(400);
    expect((await post("/api/auth/login", { email: personal.user.email })).status).toBe(400);
    expect((await post("/api/auth/login", {})).status).toBe(400);

    expect((await login(personal.user.email, "SenhaErrada@123")).status).toBe(401);
  });

  it("aceita a senha correta e devolve identidade e role", async () => {
    const { status, body } = await login(personal.user.email, SENHA);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: personal.user.id,
      email: personal.user.email,
      name: "Carlos Login",
      role: "PERSONAL",
    });
    // A resposta do login não carrega token nem hash de senha.
    expect(JSON.stringify(body)).not.toMatch(/token|password|senha/i);
  });

  it("é sensível a maiúsculas na senha", async () => {
    expect((await login(personal.user.email, SENHA.toUpperCase())).status).toBe(401);
  });

  it("recusa conta que existe no Auth mas não na aplicação", async () => {
    const email = emailNovo("orfa");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "SenhaBoa@123",
      email_confirm: true,
      app_metadata: { role: "PERSONAL" },
    });
    expect(error).toBeNull();

    // Sem linha em `users`, não há perfil de aplicação: não entra.
    const tentativa = await login(email, "SenhaBoa@123");
    expect(tentativa.status).toBe(401);
    expect(tentativa.body.error).toBe("E-mail ou senha inválidos.");

    await admin.auth.admin.deleteUser(data!.user!.id);
  });

  it("cada login abre uma sessão própria, sem derrubar a anterior", async () => {
    const primeira = await login(personal.user.email, SENHA);
    const segunda = await login(personal.user.email, SENHA);

    expect((await get("/api/me", primeira.cookie)).status).toBe(200);
    expect((await get("/api/me", segunda.cookie)).status).toBe(200);
  });
});

describe("Roles", () => {
  it("a role vem do banco, não do token", async () => {
    const personal = await createPersonal({ name: "Personal Rebaixado" });
    const { cookie } = await login(personal.user.email, SENHA);

    expect((await get("/api/personal/alunos", cookie)).status).toBe(200);

    // O token continua dizendo PERSONAL (app_metadata não mudou), mas a
    // aplicação lê a role do banco - e passa a recusar na mesma sessão.
    await prisma.user.update({ where: { id: personal.user.id }, data: { role: "ALUNO" } });

    expect((await get("/api/personal/alunos", cookie)).status).toBe(403);
    expect((await (await get("/api/me", cookie)).json()).role).toBe("ALUNO");

    await prisma.user.update({ where: { id: personal.user.id }, data: { role: "PERSONAL" } });
    expect((await get("/api/personal/alunos", cookie)).status).toBe(200);
  });

  it("role sem o perfil correspondente não abre a área", async () => {
    const personal = await createPersonal({ name: "Personal Sem Perfil" });
    const { cookie } = await login(personal.user.email, SENHA);

    await prisma.personalProfile.delete({ where: { id: personal.personalProfile.id } });

    // Autenticado (401 não), mas sem perfil de Personal: 403.
    expect((await get("/api/me", cookie)).status).toBe(200);
    expect((await get("/api/personal/alunos", cookie)).status).toBe(403);
  });

  it("as duas áreas continuam mutuamente fechadas", async () => {
    const personal = await createPersonal({ name: "Personal Fechado" });
    const aluno = await createAluno({ name: "Aluno Fechado", personalId: personal.personalProfile.id });

    const cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
    const cookieAluno = (await login(aluno.user.email, SENHA)).cookie;

    expect((await get("/api/aluno/dashboard", cookiePersonal)).status).toBe(403);
    expect((await get("/api/personal/dashboard", cookieAluno)).status).toBe(403);
    expect((await get("/api/aluno/dashboard", cookieAluno)).status).toBe(200);
    expect((await get("/api/personal/dashboard", cookiePersonal)).status).toBe(200);
  });
});

describe("Recuperação e troca de senha", () => {
  it("esqueci-senha valida o e-mail e não revela se a conta existe", async () => {
    expect((await post("/api/auth/esqueci-senha", { email: "sem-arroba" })).status).toBe(400);
    expect((await post("/api/auth/esqueci-senha", {})).status).toBe(400);

    const existente = await post("/api/auth/esqueci-senha", { email: "personal1@teste.com" });
    const inexistente = await post("/api/auth/esqueci-senha", { email: emailNovo("ninguem") });

    expect(existente.status).toBe(200);
    expect(inexistente.status).toBe(200);
  });

  it("redefinir-senha exige sessão", async () => {
    const res = await post("/api/auth/redefinir-senha", { password: "NovaSenha@123" });
    expect(res.status).toBe(401);
  });

  it("redefinir-senha valida o tamanho mínimo", async () => {
    const aluno = await createAluno({ name: "Aluno Senha Curta" });
    const { cookie } = await login(aluno.user.email, SENHA);

    const res = await post("/api/auth/redefinir-senha", { password: "curta" }, cookie);
    expect(res.status).toBe(400);

    // A senha antiga continua valendo.
    expect((await login(aluno.user.email, SENHA)).status).toBe(200);
  });

  it("troca a senha: a nova passa a valer e a antiga deixa de valer", async () => {
    const aluno = await createAluno({ name: "Aluno Troca Senha" });
    const { cookie } = await login(aluno.user.email, SENHA);

    const res = await post("/api/auth/redefinir-senha", { password: "NovaSenha@456" }, cookie);
    expect(res.status).toBe(200);

    expect((await login(aluno.user.email, "NovaSenha@456")).status).toBe(200);
    expect((await login(aluno.user.email, SENHA)).status).toBe(401);
  });
});

describe("Aluno desativado", () => {
  it("some da lista ativa do Personal, mas mantém o histórico", async () => {
    const personal = await createPersonal({ name: "Personal Desativa" });
    const aluno = await createAluno({
      name: "Aluno Desativado",
      personalId: personal.personalProfile.id,
    });
    const cookiePersonal = (await login(personal.user.email, SENHA)).cookie;

    await fetch(`${BASE_URL}/api/personal/alunos/${aluno.alunoProfile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookiePersonal },
      body: JSON.stringify({ status: "INATIVO" }),
    });

    const ativos = await (await get("/api/personal/alunos?status=ATIVO", cookiePersonal)).json();
    const todos = await (await get("/api/personal/alunos?status=TODOS", cookiePersonal)).json();

    expect(ativos.alunos.map((a: { id: string }) => a.id)).not.toContain(aluno.alunoProfile.id);
    expect(todos.alunos.map((a: { id: string }) => a.id)).toContain(aluno.alunoProfile.id);
    expect(todos.contagens.inativos).toBe(1);
  });

  it("hoje a desativação não corta o acesso do aluno", async () => {
    const personal = await createPersonal({ name: "Personal Desativa 2" });
    const aluno = await createAluno({
      name: "Aluno Ainda Entra",
      personalId: personal.personalProfile.id,
    });

    await prisma.alunoProfile.update({
      where: { id: aluno.alunoProfile.id },
      data: { status: "INATIVO" },
    });

    // Comportamento atual, fixado de propósito: `status` é um marcador de
    // carteira do Personal, não uma trava de login. Se a regra mudar para
    // bloquear o acesso, este teste é o lugar de mudar junto.
    const entrada = await login(aluno.user.email, SENHA);
    expect(entrada.status).toBe(200);
    expect((await get("/api/aluno/dashboard", entrada.cookie)).status).toBe(200);
  });
});
