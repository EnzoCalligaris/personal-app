import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { TreinoDetalhe, TreinoListResponse } from "@/types/treino";
import { resetDb } from "./db";
import { createAluno, createExercicio, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

let supino = { id: "" };
let agachamento = { id: "" };
let remada = { id: "" };
let exercicioDoOutro = { id: "" };

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluno = "";

let treinoId = "";

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Treinos" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });

  ana = await createAluno({ name: "Ana Treino", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Treino", personalId: personal.personalProfile.id });
  alunoDoOutro = await createAluno({
    name: "Aluno do Rival",
    personalId: outroPersonal.personalProfile.id,
  });

  supino = await createExercicio(personal.personalProfile.id, { nome: "Supino reto" });
  agachamento = await createExercicio(personal.personalProfile.id, { nome: "Agachamento" });
  remada = await createExercicio(personal.personalProfile.id, { nome: "Remada curvada" });
  exercicioDoOutro = await createExercicio(outroPersonal.personalProfile.id, {
    nome: "Exercício do rival",
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluno = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Treinos - autorização", () => {
  it("exige autenticação", async () => {
    expect((await get("/api/personal/treinos")).status).toBe(401);
  });

  it("nega acesso a um Aluno (endpoint administrativo)", async () => {
    expect((await get("/api/personal/treinos", cookieAluno)).status).toBe(403);
  });
});

describe("Treinos - criar e vincular ao aluno", () => {
  it("valida os dados enviados", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: "nao-e-uuid", nome: "A" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.alunoId).toBeTruthy();
    expect(body.issues.nome).toBeTruthy();
  });

  it("cria o treino vinculado ao aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          nome: "Treino A · Superior",
          observacoes: "Aquecer 5 min antes.",
        }),
      })
    );
    const treino = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(201);
    expect(treino.aluno.id).toBe(ana.alunoProfile.id);
    expect(treino.aluno.nome).toBe("Ana Treino");
    // O dia vem da programação, não do treino.
    expect(treino.diasProgramados).toEqual([]);
    expect(treino.exercicios).toEqual([]);

    treinoId = treino.id;
  });

  it("NÃO deixa vincular treino a aluno de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: alunoDoOutro.alunoProfile.id,
          nome: "Treino invasor",
        }),
      })
    );

    expect(res.status).toBe(404);
    expect(
      await prisma.treino.count({ where: { alunoId: alunoDoOutro.alunoProfile.id } })
    ).toBe(0);
  });

  it("NÃO deixa transferir um treino para aluno de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ alunoId: alunoDoOutro.alunoProfile.id }),
      })
    );
    expect(res.status).toBe(404);

    const treino = await prisma.treino.findUniqueOrThrow({ where: { id: treinoId } });
    expect(treino.alunoId).toBe(ana.alunoProfile.id);
  });
});

describe("Treinos - exercícios do treino", () => {
  it("adiciona exercícios em sequência", async () => {
    for (const [indice, exercicio] of [supino, agachamento, remada].entries()) {
      const res = await fetch(
        `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios`,
        comCookie(cookiePersonal, {
          method: "POST",
          body: JSON.stringify({
            exercicioId: exercicio.id,
            series: 3 + indice,
            repeticoes: "10-12",
            carga: `${20 + indice * 5}kg`,
            descansoSeg: 60,
          }),
        })
      );
      expect(res.status).toBe(201);
    }

    const treino = (await (
      await get(`/api/personal/treinos/${treinoId}`, cookiePersonal)
    ).json()) as TreinoDetalhe;

    expect(treino.exercicios.map((item) => item.ordem)).toEqual([1, 2, 3]);
    expect(treino.exercicios.map((item) => item.exercicio.nome)).toEqual([
      "Supino reto",
      "Agachamento",
      "Remada curvada",
    ]);
    expect(treino.totalExercicios).toBe(3);
  });

  it("NÃO deixa usar exercício da biblioteca de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ exercicioId: exercicioDoOutro.id, series: 3, repeticoes: "10" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("edita os parâmetros de um exercício do treino", async () => {
    const antes = (await (
      await get(`/api/personal/treinos/${treinoId}`, cookiePersonal)
    ).json()) as TreinoDetalhe;
    const item = antes.exercicios[0];

    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios/${item.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({
          series: 5,
          repeticoes: "6-8",
          carga: "50kg",
          descansoSeg: 90,
          observacoes: "Cadência lenta na descida.",
        }),
      })
    );
    const treino = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(200);
    const atualizado = treino.exercicios.find((exercicio) => exercicio.id === item.id)!;
    expect(atualizado.series).toBe(5);
    expect(atualizado.repeticoes).toBe("6-8");
    expect(atualizado.carga).toBe("50kg");
    expect(atualizado.descansoSeg).toBe(90);
    expect(atualizado.observacoes).toBe("Cadência lenta na descida.");
  });

  it("reordena os exercícios (invertendo a ordem)", async () => {
    const antes = (await (
      await get(`/api/personal/treinos/${treinoId}`, cookiePersonal)
    ).json()) as TreinoDetalhe;

    const invertida = [...antes.exercicios].reverse().map((item) => item.id);

    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios/ordem`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ itens: invertida }) })
    );
    const treino = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(200);
    expect(treino.exercicios.map((item) => item.id)).toEqual(invertida);
    expect(treino.exercicios.map((item) => item.ordem)).toEqual([1, 2, 3]);
  });

  it("recusa uma ordem que não corresponde aos itens do treino", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios/ordem`,
      comCookie(cookiePersonal, {
        method: "PUT",
        body: JSON.stringify({ itens: ["00000000-0000-0000-0000-000000000000"] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("remove um exercício e renumera os restantes", async () => {
    const antes = (await (
      await get(`/api/personal/treinos/${treinoId}`, cookiePersonal)
    ).json()) as TreinoDetalhe;
    const primeiro = antes.exercicios[0];

    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/exercicios/${primeiro.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    const treino = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(200);
    expect(treino.exercicios).toHaveLength(2);
    expect(treino.exercicios.map((item) => item.ordem)).toEqual([1, 2]);
    expect(treino.exercicios.some((item) => item.id === primeiro.id)).toBe(false);
  });
});

describe("Treinos - duplicar", () => {
  it("duplica o treino com os exercícios, para o mesmo aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/duplicar`,
      comCookie(cookiePersonal, { method: "POST", body: JSON.stringify({}) })
    );
    const copia = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(201);
    expect(copia.id).not.toBe(treinoId);
    expect(copia.nome).toBe("Treino A · Superior (cópia)");
    expect(copia.aluno.id).toBe(ana.alunoProfile.id);
    expect(copia.exercicios).toHaveLength(2);
    expect(copia.exercicios.map((item) => item.ordem)).toEqual([1, 2]);

    // O original continua intacto.
    const original = (await (
      await get(`/api/personal/treinos/${treinoId}`, cookiePersonal)
    ).json()) as TreinoDetalhe;
    expect(original.exercicios).toHaveLength(2);
  });

  it("duplica para outro aluno do mesmo Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/duplicar`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: bruno.alunoProfile.id, nome: "Treino do Bruno" }),
      })
    );
    const copia = (await res.json()) as TreinoDetalhe;

    expect(res.status).toBe(201);
    expect(copia.aluno.id).toBe(bruno.alunoProfile.id);
    expect(copia.nome).toBe("Treino do Bruno");
  });

  it("NÃO duplica para aluno de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}/duplicar`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: alunoDoOutro.alunoProfile.id }),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("Treinos - listar e filtrar", () => {
  it("lista apenas os treinos do próprio Personal", async () => {
    const data = (await (
      await get("/api/personal/treinos?status=TODOS", cookiePersonal)
    ).json()) as TreinoListResponse;

    expect(data.treinos.length).toBeGreaterThanOrEqual(3);
    expect(data.treinos.every((treino) => treino.aluno.nome !== "Aluno do Rival")).toBe(true);

    const doOutro = (await (
      await get("/api/personal/treinos?status=TODOS", cookieOutroPersonal)
    ).json()) as TreinoListResponse;
    expect(doOutro.treinos).toHaveLength(0);
  });

  it("filtra por aluno", async () => {
    const doBruno = (await (
      await get(`/api/personal/treinos?alunoId=${bruno.alunoProfile.id}&status=TODOS`, cookiePersonal)
    ).json()) as TreinoListResponse;
    expect(doBruno.treinos.map((treino) => treino.nome)).toEqual(["Treino do Bruno"]);
  });

  it("busca por nome do treino e por nome do aluno", async () => {
    const porTreino = (await (
      await get("/api/personal/treinos?q=Superior&status=TODOS", cookiePersonal)
    ).json()) as TreinoListResponse;
    expect(porTreino.treinos.length).toBeGreaterThan(0);

    const porAluno = (await (
      await get("/api/personal/treinos?q=Bruno&status=TODOS", cookiePersonal)
    ).json()) as TreinoListResponse;
    expect(porAluno.treinos.every((treino) => treino.aluno.nome.includes("Bruno"))).toBe(true);
  });
});

describe("Treinos - desativar e excluir", () => {
  it("desativa e reativa o treino", async () => {
    const desativar = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ ativo: false }) })
    );
    expect(((await desativar.json()) as TreinoDetalhe).ativo).toBe(false);

    const ativos = (await (
      await get("/api/personal/treinos?status=ATIVOS", cookiePersonal)
    ).json()) as TreinoListResponse;
    expect(ativos.treinos.some((treino) => treino.id === treinoId)).toBe(false);

    const reativar = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ ativo: true }) })
    );
    expect(((await reativar.json()) as TreinoDetalhe).ativo).toBe(true);
  });

  it("não deixa outro Personal mexer no treino", async () => {
    expect((await get(`/api/personal/treinos/${treinoId}`, cookieOutroPersonal)).status).toBe(404);

    const patch = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookieOutroPersonal, { method: "PATCH", body: JSON.stringify({ nome: "Roubado" }) })
    );
    expect(patch.status).toBe(404);

    const del = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookieOutroPersonal, { method: "DELETE" })
    );
    expect(del.status).toBe(404);

    expect(await prisma.treino.findUnique({ where: { id: treinoId } })).not.toBeNull();
  });

  it("exclui o treino e os exercícios dele", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    expect(await prisma.treino.findUnique({ where: { id: treinoId } })).toBeNull();
    expect(await prisma.treinoExercicio.count({ where: { treinoId } })).toBe(0);

    // A biblioteca de exercícios continua intacta.
    expect(await prisma.exercicio.count({ where: { personalId: personal.personalProfile.id } })).toBe(3);
  });
});
