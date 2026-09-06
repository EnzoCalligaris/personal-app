import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

/**
 * Regras que precisam valer no servidor, e não só no formulário: quem está
 * inativo não ocupa agenda, e nenhum texto entra sem limite de tamanho.
 */

const DIAS_SEMANA = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const;

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ativa: Awaited<ReturnType<typeof createAluno>>;
let inativo: Awaited<ReturnType<typeof createAluno>>;

let cookiePersonal = "";
let cookieAtiva = "";
let cookieInativo = "";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Regras" });
  ativa = await createAluno({ name: "Aluna Ativa", personalId: personal.personalProfile.id });
  inativo = await createAluno({ name: "Aluno Inativo", personalId: personal.personalProfile.id });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieAtiva = (await login(ativa.user.email, SENHA)).cookie;
  cookieInativo = (await login(inativo.user.email, SENHA)).cookie;

  await prisma.disponibilidade.createMany({
    data: DIAS_SEMANA.map((diaSemana) => ({
      personalId: personal.personalProfile.id,
      diaSemana,
      horaInicio: "06:00",
      horaFim: "22:00",
      duracaoMin: 60,
    })),
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Aluno desativado não ocupa a agenda do Personal", () => {
  it("antes de desativar, ele marca normalmente", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos`,
      comCookie(cookieInativo, {
        method: "POST",
        body: JSON.stringify({ data: emDias(3), horaInicio: "07:00", horaFim: "08:00" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("o Personal desativa pela API", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${inativo.alunoProfile.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ status: "INATIVO" }) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("INATIVO");
  });

  it("depois de desativado, NÃO consegue marcar", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos`,
      comCookie(cookieInativo, {
        method: "POST",
        body: JSON.stringify({ data: emDias(4), horaInicio: "09:00", horaFim: "10:00" }),
      })
    );
    const corpo = await res.json();

    expect(res.status).toBe(409);
    expect(corpo.error).toMatch(/inativo/i);

    // E nada foi gravado.
    const marcados = await prisma.agendamento.count({
      where: { alunoId: inativo.alunoProfile.id, horaInicio: "09:00" },
    });
    expect(marcados).toBe(0);
  });

  it("a tela de horários explica o motivo em vez de vir vazia sem razão", async () => {
    const res = await get(`/api/aluno/agenda/horarios?data=${emDias(4)}`, cookieInativo);
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.livres).toHaveLength(0);
    expect(corpo.motivo).toBe("ALUNO_INATIVO");
    expect(corpo.mensagem).toMatch(/inativo/i);
  });

  it("NÃO consegue remarcar o horário que já tinha", async () => {
    const existente = await prisma.agendamento.findFirstOrThrow({
      where: { alunoId: inativo.alunoProfile.id, status: { in: ["AGENDADO", "CONFIRMADO"] } },
    });

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${existente.id}`,
      comCookie(cookieInativo, {
        method: "PATCH",
        body: JSON.stringify({ data: emDias(5), horaInicio: "11:00", horaFim: "12:00" }),
      })
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/inativo/i);
  });

  it("MAS continua podendo cancelar - soltar horário não ocupa agenda", async () => {
    const existente = await prisma.agendamento.findFirstOrThrow({
      where: { alunoId: inativo.alunoProfile.id, status: { in: ["AGENDADO", "CONFIRMADO"] } },
    });

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${existente.id}`,
      comCookie(cookieInativo, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("CANCELADO");
  });

  it("e continua vendo os próprios dados - o histórico é dele", async () => {
    expect((await get("/api/aluno/dashboard", cookieInativo)).status).toBe(200);
    expect((await get("/api/aluno/treinos", cookieInativo)).status).toBe(200);
    expect((await get("/api/aluno/historico", cookieInativo)).status).toBe(200);
    expect((await get("/api/aluno/agenda", cookieInativo)).status).toBe(200);
  });

  it("a regra não atinge quem está ativo", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos`,
      comCookie(cookieAtiva, {
        method: "POST",
        body: JSON.stringify({ data: emDias(4), horaInicio: "09:00", horaFim: "10:00" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("o Personal reativa e o aluno volta a marcar", async () => {
    await fetch(
      `${BASE_URL}/api/personal/alunos/${inativo.alunoProfile.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ status: "ATIVO" }) })
    );

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos`,
      comCookie(cookieInativo, {
        method: "POST",
        body: JSON.stringify({ data: emDias(6), horaInicio: "07:00", horaFim: "08:00" }),
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("Nenhum texto entra sem limite de tamanho", () => {
  const gigante = "a".repeat(500);

  it("recusa nome gigante no cadastro de aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ name: gigante, email: "gigante@example.com" }),
      })
    );

    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: "gigante@example.com" } })).toBe(0);
  });

  it("recusa nome gigante na edição de aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${ativa.alunoProfile.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ name: gigante }) })
    );
    expect(res.status).toBe(400);

    const aluno = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: ativa.alunoProfile.id },
      include: { user: { select: { name: true } } },
    });
    expect(aluno.user.name).toBe("Aluna Ativa");
  });

  it("recusa nome gigante em exercício e treino", async () => {
    const exercicio = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ nome: gigante, grupoMuscular: "Peito" }),
      })
    );
    expect(exercicio.status).toBe(400);

    const treino = await fetch(
      `${BASE_URL}/api/personal/treinos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: ativa.alunoProfile.id, nome: gigante }),
      })
    );
    expect(treino.status).toBe(400);
  });

  it("recusa nome gigante no cadastro de conta", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: gigante,
        email: "conta-gigante@example.com",
        password: "SenhaBoa@123",
        role: "PERSONAL",
      }),
    });

    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: "conta-gigante@example.com" } })).toBe(0);
  });

  it("recusa senha acima do que o hash aproveita", async () => {
    const senhaEnorme = "S".repeat(200);

    const registro = await fetch(`${BASE_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Senha Enorme",
        email: "senha-enorme@example.com",
        password: senhaEnorme,
        role: "ALUNO",
      }),
    });
    expect(registro.status).toBe(400);

    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ativa.user.email, password: senhaEnorme }),
    });
    expect(login.status).toBe(400);
  });

  it("continua aceitando um nome normal, inclusive longo de verdade", async () => {
    const nomeReal = "Ana Carolina de Vasconcelos Montenegro do Nascimento Filha";

    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${ativa.alunoProfile.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ name: nomeReal }) })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).nome).toBe(nomeReal);
  });
});
