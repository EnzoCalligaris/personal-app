import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { RegrasAgendamento } from "@/types/agenda";
import type { MeuPerfil } from "@/types/aluno-area";
import { resetDb } from "./db";
import { createAluno, createPersonal, createTreino } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

type PerfilPersonal = {
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  cref: string | null;
  bio: string | null;
  membroDesde: string;
  resumo: { alunos: number; alunosAtivos: number; treinos: number };
};

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAna = "";

function editarPersonal(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/perfil`,
    comCookie(cookie, { method: "PATCH", body: JSON.stringify(corpo) })
  );
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  await createTreino(personal.personalProfile.id, ana.alunoProfile.id, { nome: "Treino A" });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Perfil do Personal", () => {
  it("exige role PERSONAL", async () => {
    expect((await get("/api/personal/perfil")).status).toBe(401);
    expect((await get("/api/personal/perfil", cookieAna)).status).toBe(403);
  });

  it("devolve os próprios dados e o resumo", async () => {
    const res = await get("/api/personal/perfil", cookiePersonal);
    const perfil = (await res.json()) as PerfilPersonal;

    expect(res.status).toBe(200);
    expect(perfil.nome).toBe("Carlos Personal");
    expect(perfil.email).toBe(personal.user.email);
    expect(perfil.resumo).toEqual({ alunos: 1, alunosAtivos: 1, treinos: 1 });
  });

  it("edita nome, telefone, CREF e bio", async () => {
    const res = await editarPersonal(cookiePersonal, {
      nome: "Carlos Personal Silva",
      telefone: "(11) 91234-5678",
      cref: "123456-G/SP",
      bio: "Treinamento de força e reabilitação.",
    });
    const perfil = (await res.json()) as PerfilPersonal;

    expect(res.status).toBe(200);
    expect(perfil.nome).toBe("Carlos Personal Silva");
    expect(perfil.telefone).toBe("(11) 91234-5678");
    expect(perfil.cref).toBe("123456-G/SP");
    expect(perfil.bio).toBe("Treinamento de força e reabilitação.");
    // O e-mail continua sendo o da conta.
    expect(perfil.email).toBe(personal.user.email);
  });

  it("valida os campos", async () => {
    const nomeCurto = await editarPersonal(cookiePersonal, { nome: "C" });
    expect(nomeCurto.status).toBe(400);
    expect((await nomeCurto.json()).issues.nome).toBeTruthy();

    const telefoneInvalido = await editarPersonal(cookiePersonal, { telefone: "abc" });
    expect(telefoneInvalido.status).toBe(400);

    const bioLonga = await editarPersonal(cookiePersonal, { bio: "x".repeat(501) });
    expect(bioLonga.status).toBe(400);
  });

  it("cada Personal só altera o próprio perfil", async () => {
    await editarPersonal(cookieOutroPersonal, { nome: "Rival Editado" });

    const doPrimeiro = (await (
      await get("/api/personal/perfil", cookiePersonal)
    ).json()) as PerfilPersonal;
    expect(doPrimeiro.nome).toBe("Carlos Personal Silva");
  });
});

describe("Configurações da agenda", () => {
  it("guarda a duração padrão junto das demais regras", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/agenda/regras`,
      comCookie(cookiePersonal, {
        method: "PUT",
        body: JSON.stringify({
          duracaoPadraoMin: 45,
          antecedenciaMinHoras: 6,
          janelaDias: 45,
          cancelamentoMinHoras: 24,
        }),
      })
    );
    const { regras } = (await res.json()) as { regras: RegrasAgendamento };

    expect(res.status).toBe(200);
    expect(regras.duracaoPadraoMin).toBe(45);
    expect(regras.antecedenciaMinHoras).toBe(6);
    expect(regras.janelaDias).toBe(45);
    expect(regras.cancelamentoMinHoras).toBe(24);
  });

  it("recusa valores fora do permitido", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/agenda/regras`,
      comCookie(cookiePersonal, {
        method: "PUT",
        body: JSON.stringify({ duracaoPadraoMin: 5, janelaDias: 999 }),
      })
    );
    expect(res.status).toBe(400);

    // Nada foi salvo pela metade.
    const atual = (await (
      await get("/api/personal/agenda/regras", cookiePersonal)
    ).json()) as { regras: RegrasAgendamento };
    expect(atual.regras.duracaoPadraoMin).toBe(45);
    expect(atual.regras.janelaDias).toBe(45);
  });

  it("as regras de um Personal não afetam o outro", async () => {
    const doOutro = (await (
      await get("/api/personal/agenda/regras", cookieOutroPersonal)
    ).json()) as { regras: RegrasAgendamento };

    // Sem configuração salva, valem os padrões.
    expect(doOutro.regras.duracaoPadraoMin).toBe(60);
    expect(doOutro.regras.antecedenciaMinHoras).toBe(12);
  });
});

describe("Perfil do aluno", () => {
  it("edita os próprios dados com validação", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/perfil`,
      comCookie(cookieAna, {
        method: "PATCH",
        body: JSON.stringify({
          nome: "Ana Aluna Silva",
          telefone: "(11) 90000-0000",
          altura: 168,
          objetivo: "Hipertrofia",
        }),
      })
    );
    const perfil = (await res.json()) as MeuPerfil;

    expect(res.status).toBe(200);
    expect(perfil.nome).toBe("Ana Aluna Silva");
    expect(perfil.altura).toBe(168);

    const alturaAbsurda = await fetch(
      `${BASE_URL}/api/aluno/perfil`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ altura: 12 }) })
    );
    expect(alturaAbsurda.status).toBe(400);
  });
});

describe("Foto de perfil", () => {
  it("exige autenticação", async () => {
    const res = await fetch(`${BASE_URL}/api/perfil/foto`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("recusa arquivo ausente ou de formato inválido", async () => {
    const semArquivo = await fetch(
      `${BASE_URL}/api/perfil/foto`,
      comCookie(cookieAna, { method: "POST", body: new FormData(), headers: { Cookie: cookieAna } })
    );
    expect(semArquivo.status).toBe(400);

    const form = new FormData();
    form.append("file", new File(["texto"], "nota.txt", { type: "text/plain" }));

    const formatoErrado = await fetch(`${BASE_URL}/api/perfil/foto`, {
      method: "POST",
      headers: { Cookie: cookieAna },
      body: form,
    });
    const body = await formatoErrado.json();

    expect(formatoErrado.status).toBe(400);
    expect(body.error).toMatch(/formato/i);
  });
});
