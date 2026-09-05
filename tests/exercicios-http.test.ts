import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { ExercicioItem, ExercicioListResponse } from "@/types/exercicio";
import { resetDb } from "./db";
import { createAluno, createPersonal, createTreino } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let aluno: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluno = "";

let supinoId = "";
let exercicioDoOutroId = "";

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Exercicios" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });
  aluno = await createAluno({ name: "Aluno Teste", personalId: personal.personalProfile.id });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluno = (await login(aluno.user.email, SENHA)).cookie;

  const doOutro = await prisma.exercicio.create({
    data: {
      personalId: outroPersonal.personalProfile.id,
      nome: "Exercício do rival",
      grupoMuscular: "Costas",
    },
  });
  exercicioDoOutroId = doOutro.id;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Exercícios - autorização", () => {
  it("exige autenticação", async () => {
    expect((await get("/api/personal/exercicios")).status).toBe(401);
  });

  it("nega acesso a um Aluno (endpoint administrativo)", async () => {
    expect((await get("/api/personal/exercicios", cookieAluno)).status).toBe(403);
  });
});

describe("Exercícios - cadastrar", () => {
  it("valida os dados enviados", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ nome: "A", grupoMuscular: "Inexistente" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.nome).toBeTruthy();
    expect(body.issues.grupoMuscular).toBeTruthy();
  });

  it("recusa URL de vídeo inválida", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          nome: "Remada",
          grupoMuscular: "Costas",
          videoUrl: "nao-e-uma-url",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("cadastra o exercício na biblioteca do Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          nome: "Supino reto",
          grupoMuscular: "Peito",
          descricao: "Barra, pegada média, descer até o peito.",
          videoUrl: "https://youtube.com/watch?v=abc",
        }),
      })
    );
    const exercicio = (await res.json()) as ExercicioItem;

    expect(res.status).toBe(201);
    expect(exercicio.nome).toBe("Supino reto");
    expect(exercicio.grupoMuscular).toBe("Peito");
    expect(exercicio.ativo).toBe(true);
    expect(exercicio.usadoEmTreinos).toBe(0);

    supinoId = exercicio.id;
  });

  it("recusa nome repetido na mesma biblioteca (ignorando maiúsculas)", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ nome: "supino RETO", grupoMuscular: "Peito" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("permite o mesmo nome em bibliotecas de Personals diferentes", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookieOutroPersonal, {
        method: "POST",
        body: JSON.stringify({ nome: "Supino reto", grupoMuscular: "Peito" }),
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("Exercícios - listar, buscar e filtrar", () => {
  beforeAll(async () => {
    await fetch(
      `${BASE_URL}/api/personal/exercicios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ nome: "Agachamento livre", grupoMuscular: "Pernas" }),
      })
    );
  });

  it("lista apenas a biblioteca do próprio Personal", async () => {
    const data = (await (
      await get("/api/personal/exercicios", cookiePersonal)
    ).json()) as ExercicioListResponse;

    expect(data.exercicios.map((e) => e.nome).sort()).toEqual([
      "Agachamento livre",
      "Supino reto",
    ]);
    expect(data.exercicios.some((e) => e.id === exercicioDoOutroId)).toBe(false);
  });

  it("busca por nome e por descrição", async () => {
    const porNome = (await (
      await get("/api/personal/exercicios?q=agacha", cookiePersonal)
    ).json()) as ExercicioListResponse;
    expect(porNome.exercicios).toHaveLength(1);

    const porDescricao = (await (
      await get("/api/personal/exercicios?q=pegada", cookiePersonal)
    ).json()) as ExercicioListResponse;
    expect(porDescricao.exercicios.map((e) => e.nome)).toEqual(["Supino reto"]);
  });

  it("filtra por grupo muscular e devolve os grupos disponíveis", async () => {
    const data = (await (
      await get("/api/personal/exercicios?grupo=Pernas", cookiePersonal)
    ).json()) as ExercicioListResponse;

    expect(data.exercicios.map((e) => e.nome)).toEqual(["Agachamento livre"]);
    expect(data.grupos.map((g) => g.nome).sort()).toEqual(["Peito", "Pernas"]);
  });
});

describe("Exercícios - editar e arquivar", () => {
  it("edita os dados do exercício", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios/${supinoId}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ nome: "Supino reto com barra", grupoMuscular: "Ombros" }),
      })
    );
    const exercicio = (await res.json()) as ExercicioItem;

    expect(res.status).toBe(200);
    expect(exercicio.nome).toBe("Supino reto com barra");
    expect(exercicio.grupoMuscular).toBe("Ombros");
  });

  it("não deixa editar exercício de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios/${exercicioDoOutroId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ nome: "Invadido" }) })
    );
    expect(res.status).toBe(404);
  });

  it("arquiva e restaura, refletindo nos filtros", async () => {
    const arquivar = await fetch(
      `${BASE_URL}/api/personal/exercicios/${supinoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ ativo: false }) })
    );
    expect(arquivar.status).toBe(200);

    const ativos = (await (
      await get("/api/personal/exercicios?status=ATIVOS", cookiePersonal)
    ).json()) as ExercicioListResponse;
    expect(ativos.exercicios.some((e) => e.id === supinoId)).toBe(false);
    expect(ativos.contagens.arquivados).toBe(1);

    const arquivados = (await (
      await get("/api/personal/exercicios?status=ARQUIVADOS", cookiePersonal)
    ).json()) as ExercicioListResponse;
    expect(arquivados.exercicios.map((e) => e.id)).toEqual([supinoId]);

    const restaurar = await fetch(
      `${BASE_URL}/api/personal/exercicios/${supinoId}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ ativo: true }) })
    );
    expect(restaurar.status).toBe(200);
  });
});

describe("Exercícios - excluir", () => {
  it("exclui um exercício que não está em nenhum treino", async () => {
    const criado = (await (
      await fetch(
        `${BASE_URL}/api/personal/exercicios`,
        comCookie(cookiePersonal, {
          method: "POST",
          body: JSON.stringify({ nome: "Exercício descartável", grupoMuscular: "Cardio" }),
        })
      )
    ).json()) as ExercicioItem;

    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios/${criado.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    expect(
      (await get(`/api/personal/exercicios/${criado.id}`, cookiePersonal)).status
    ).toBe(404);
  });

  it("recusa excluir exercício usado em treino e sugere arquivar", async () => {
    const treino = await createTreino(personal.personalProfile.id, aluno.alunoProfile.id, {
      nome: "Treino com supino",
    });
    await prisma.treinoExercicio.create({
      data: { treinoId: treino.id, exercicioId: supinoId, ordem: 1, series: 3, repeticoes: "10" },
    });

    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios/${supinoId}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.usos).toBe(1);

    // O exercício e o vínculo com o treino continuam intactos.
    const aindaExiste = await prisma.exercicio.findUnique({ where: { id: supinoId } });
    expect(aindaExiste).not.toBeNull();
    expect(await prisma.treinoExercicio.count({ where: { exercicioId: supinoId } })).toBe(1);

    // E a listagem informa o uso, para a interface oferecer arquivar.
    const data = (await (
      await get("/api/personal/exercicios", cookiePersonal)
    ).json()) as ExercicioListResponse;
    expect(data.exercicios.find((e) => e.id === supinoId)?.usadoEmTreinos).toBe(1);
  });

  it("não deixa excluir exercício de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/exercicios/${exercicioDoOutroId}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(404);
    expect(await prisma.exercicio.findUnique({ where: { id: exercicioDoOutroId } })).not.toBeNull();
  });
});
