import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { diaSemanaDe } from "@/lib/date-utils";
import type { AlunoDetalhe, AlunoListResponse } from "@/types/aluno";
import { resetDb } from "./db";
import {
  createAluno,
  createAvaliacao,
  createPersonal,
  createProgramacao,
  createTreino,
} from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluno = "";

/** E-mail único por execução, para o teste poder rodar repetidas vezes. */
const emailNovoAluno = `novo-aluno-${Date.now()}@example.com`;
let alunoCriadoId = "";

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal CRUD" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });
  alunoDoOutro = await createAluno({
    name: "Aluno do Rival",
    personalId: outroPersonal.personalProfile.id,
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluno = (await login(alunoDoOutro.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Alunos - autorização", () => {
  it("exige autenticação para listar", async () => {
    expect((await get("/api/personal/alunos")).status).toBe(401);
  });

  it("nega acesso a um Aluno (endpoint administrativo)", async () => {
    expect((await get("/api/personal/alunos", cookieAluno)).status).toBe(403);
  });

  it("nega criação de aluno sem sessão", async () => {
    const res = await fetch(`${BASE_URL}/api/personal/alunos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X", email: "x@example.com" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("Alunos - criar", () => {
  it("valida os dados enviados", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ name: "A", email: "sem-arroba" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.name).toBeTruthy();
    expect(body.issues.email).toBeTruthy();
  });

  it("cria o aluno vinculado ao Personal e devolve a senha temporária", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          name: "Joana Teste",
          email: emailNovoAluno,
          phone: "(11) 91234-5678",
          dataNascimento: "1995-06-15",
          altura: 168,
          objetivo: "Hipertrofia",
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.aluno.nome).toBe("Joana Teste");
    expect(body.aluno.status).toBe("ATIVO");
    expect(body.senhaTemporaria).toMatch(/^Pulse[0-9A-F]{8}!$/);

    alunoCriadoId = body.aluno.id;

    // O aluno criado precisa conseguir entrar com a senha temporária.
    const loginAluno = await login(emailNovoAluno, body.senhaTemporaria);
    expect(loginAluno.status).toBe(200);
    expect(loginAluno.body.role).toBe("ALUNO");
  });

  it("rejeita e-mail já cadastrado", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ name: "Outra Joana", email: emailNovoAluno }),
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("Alunos - listar, buscar e filtrar", () => {
  it("lista apenas os alunos do próprio Personal", async () => {
    const res = await get("/api/personal/alunos", cookiePersonal);
    const data = (await res.json()) as AlunoListResponse;

    expect(res.status).toBe(200);
    expect(data.alunos.map((a) => a.nome)).toEqual(["Joana Teste"]);
    expect(data.contagens).toEqual({ todos: 1, ativos: 1, inativos: 0 });

    const outro = await get("/api/personal/alunos", cookieOutroPersonal);
    const dataOutro = (await outro.json()) as AlunoListResponse;
    expect(dataOutro.alunos.map((a) => a.nome)).toEqual(["Aluno do Rival"]);
  });

  it("busca por nome e por e-mail", async () => {
    const porNome = (await (await get("/api/personal/alunos?q=joana", cookiePersonal)).json()) as AlunoListResponse;
    expect(porNome.alunos).toHaveLength(1);

    const porEmail = (await (
      await get(`/api/personal/alunos?q=${encodeURIComponent(emailNovoAluno.slice(0, 12))}`, cookiePersonal)
    ).json()) as AlunoListResponse;
    expect(porEmail.alunos).toHaveLength(1);

    const semResultado = (await (
      await get("/api/personal/alunos?q=inexistente", cookiePersonal)
    ).json()) as AlunoListResponse;
    expect(semResultado.alunos).toHaveLength(0);
    // As contagens continuam refletindo o total, não a busca.
    expect(semResultado.contagens.todos).toBe(1);
  });

  it("traz próximo treino e última avaliação na listagem", async () => {
    const hoje = diaSemanaDe(new Date());
    const treino = await createTreino(personal.personalProfile.id, alunoCriadoId, {
      nome: "Treino A · Superior",
    });
    // O "próximo treino" vem da programação do aluno.
    await createProgramacao(personal.personalProfile.id, alunoCriadoId, {
      dias: [{ diaSemana: hoje, treinoId: treino.id }],
    });
    await createAvaliacao(personal.personalProfile.id, alunoCriadoId, { peso: 64.5 });

    const data = (await (await get("/api/personal/alunos", cookiePersonal)).json()) as AlunoListResponse;
    const aluno = data.alunos[0];

    expect(aluno.proximoTreino?.nome).toBe("Treino A · Superior");
    expect(aluno.ultimaAvaliacao?.peso).toBe(64.5);
  });
});

describe("Alunos - visualizar", () => {
  it("retorna o detalhe completo do próprio aluno", async () => {
    const res = await get(`/api/personal/alunos/${alunoCriadoId}`, cookiePersonal);
    const aluno = (await res.json()) as AlunoDetalhe;

    expect(res.status).toBe(200);
    expect(aluno.nome).toBe("Joana Teste");
    expect(aluno.telefone).toBe("(11) 91234-5678");
    expect(aluno.dataNascimento?.slice(0, 10)).toBe("1995-06-15");
    expect(aluno.altura).toBe(168);
    expect(aluno.objetivo).toBe("Hipertrofia");
    expect(aluno.metricas.totalTreinos).toBe(1);
    expect(aluno.metricas.totalAvaliacoes).toBe(1);
  });

  it("responde 404 para aluno de outro Personal", async () => {
    const res = await get(`/api/personal/alunos/${alunoDoOutro.alunoProfile.id}`, cookiePersonal);
    expect(res.status).toBe(404);
  });

  it("responde 404 para id inexistente", async () => {
    const res = await get(
      "/api/personal/alunos/00000000-0000-0000-0000-000000000000",
      cookiePersonal
    );
    expect(res.status).toBe(404);
  });
});

describe("Alunos - editar", () => {
  it("atualiza os dados do aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${alunoCriadoId}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({
          name: "Joana Teste Silva",
          phone: "(11) 90000-0000",
          objetivo: "Emagrecimento",
        }),
      })
    );
    const aluno = (await res.json()) as AlunoDetalhe;

    expect(res.status).toBe(200);
    expect(aluno.nome).toBe("Joana Teste Silva");
    expect(aluno.telefone).toBe("(11) 90000-0000");
    expect(aluno.objetivo).toBe("Emagrecimento");
    // O e-mail não muda pela edição.
    expect(aluno.email).toBe(emailNovoAluno);
  });

  it("valida os dados na edição", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${alunoCriadoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ name: "A" }) })
    );
    expect(res.status).toBe(400);
  });

  it("não deixa um Personal editar aluno de outro", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${alunoDoOutro.alunoProfile.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ name: "Invadido" }),
      })
    );
    expect(res.status).toBe(404);

    // E o aluno do outro Personal continua intacto.
    const intacto = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: alunoDoOutro.alunoProfile.id },
      include: { user: { select: { name: true } } },
    });
    expect(intacto.user.name).toBe("Aluno do Rival");
  });
});

describe("Alunos - desativar e reativar", () => {
  it("desativa o aluno sem apagar nada", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${alunoCriadoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ status: "INATIVO" }) })
    );
    const aluno = (await res.json()) as AlunoDetalhe;

    expect(res.status).toBe(200);
    expect(aluno.status).toBe("INATIVO");
    // O histórico continua lá.
    expect(aluno.metricas.totalTreinos).toBe(1);
    expect(aluno.metricas.totalAvaliacoes).toBe(1);
  });

  it("reflete o status nos filtros e contagens da listagem", async () => {
    const todos = (await (await get("/api/personal/alunos", cookiePersonal)).json()) as AlunoListResponse;
    expect(todos.contagens).toEqual({ todos: 1, ativos: 0, inativos: 1 });

    const ativos = (await (
      await get("/api/personal/alunos?status=ATIVO", cookiePersonal)
    ).json()) as AlunoListResponse;
    expect(ativos.alunos).toHaveLength(0);

    const inativos = (await (
      await get("/api/personal/alunos?status=INATIVO", cookiePersonal)
    ).json()) as AlunoListResponse;
    expect(inativos.alunos).toHaveLength(1);
  });

  it("reativa o aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/alunos/${alunoCriadoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ status: "ATIVO" }) })
    );
    const aluno = (await res.json()) as AlunoDetalhe;

    expect(res.status).toBe(200);
    expect(aluno.status).toBe("ATIVO");
  });
});
