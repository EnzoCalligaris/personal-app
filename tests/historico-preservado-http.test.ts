import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createExercicio, createPersonal, createTreino } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

/**
 * O histórico é do aluno: registra o que ele realmente fez. Excluir a ficha é
 * uma ação do Personal sobre um modelo de treino - não pode apagar o que já
 * aconteceu.
 *
 * O caminho testado é o da vida real: criar a ficha, executar, excluir a
 * ficha, e conferir que o histórico continua inteiro e sem erro.
 */

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieAna = "";

let treinoId = "";
let execucaoId = "";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Histórico" });
  ana = await createAluno({ name: "Ana Histórico", personalId: personal.personalProfile.id });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("O histórico sobrevive à exclusão da ficha", () => {
  it("1. o Personal cria o treino", async () => {
    const supino = await createExercicio(personal.personalProfile.id, { nome: "Supino reto" });
    const remada = await createExercicio(personal.personalProfile.id, { nome: "Remada curvada" });

    const treino = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
      nome: "Treino A · Superior",
      exercicios: [
        { exercicioId: supino.id, ordem: 1, series: 4, repeticoes: "10", carga: "40kg" },
        { exercicioId: remada.id, ordem: 2, series: 3, repeticoes: "12", carga: "30kg" },
      ],
    });
    treinoId = treino.id;

    expect((await get(`/api/aluno/treinos/${treinoId}`, cookieAna)).status).toBe(200);
  });

  it("2. o aluno registra a execução", async () => {
    const itens = await prisma.treinoExercicio.findMany({
      where: { treinoId },
      orderBy: { ordem: "asc" },
    });

    const res = await fetch(
      `${BASE_URL}/api/aluno/treinos/${treinoId}/execucoes`,
      comCookie(cookieAna, {
        method: "POST",
        body: JSON.stringify({
          duracaoSeg: 3600,
          observacoes: "Ombro incomodou na última série.",
          itens: [
            { treinoExercicioId: itens[0].id, series: 4, repeticoes: "10", carga: "42,5kg" },
            { treinoExercicioId: itens[1].id, series: 3, repeticoes: "12", carga: "30kg" },
          ],
        }),
      })
    );
    const execucao = await res.json();
    execucaoId = execucao.id;

    expect(res.status).toBe(201);
    expect(execucao.treino.nome).toBe("Treino A · Superior");
    expect(execucao.treino.id).toBe(treinoId);
    expect(execucao.itens).toHaveLength(2);
  });

  it("3. o Personal exclui o treino original", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treinoId}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    // A ficha foi mesmo embora.
    expect(await prisma.treino.findUnique({ where: { id: treinoId } })).toBeNull();
    expect((await get(`/api/aluno/treinos/${treinoId}`, cookieAna)).status).toBe(404);
  });

  it("4 e 5. o histórico continua disponível, com tudo que foi registrado", async () => {
    const res = await get("/api/aluno/historico", cookieAna);
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.execucoes).toHaveLength(1);

    const execucao = corpo.execucoes[0];

    // O que o aluno fez continua inteiro.
    expect(execucao.id).toBe(execucaoId);
    expect(execucao.treino.nome).toBe("Treino A · Superior");
    expect(execucao.duracaoSeg).toBe(3600);
    expect(execucao.observacoes).toBe("Ombro incomodou na última série.");
    expect(execucao.data).toBeTruthy();
    expect(execucao.totalExercicios).toBe(2);

    // Nome, séries, repetições e carga de cada exercício.
    const [primeiro, segundo] = execucao.itens;
    expect(primeiro.nome).toBe("Supino reto");
    expect(primeiro.series).toBe(4);
    expect(primeiro.repeticoes).toBe("10");
    expect(primeiro.carga).toBe("42,5kg");
    expect(primeiro.grupoMuscular).toBeTruthy();
    expect(segundo.nome).toBe("Remada curvada");
    expect(segundo.carga).toBe("30kg");

    // E a interface sabe que a ficha não existe mais.
    expect(execucao.treino.id).toBeNull();
  });

  it("6. nenhuma tela quebra por causa do relacionamento ausente", async () => {
    for (const rota of [
      "/api/aluno/historico",
      "/api/aluno/treinos",
      "/api/aluno/dashboard",
      "/api/aluno/progresso",
      "/api/aluno/evolucao",
    ]) {
      const res = await get(rota, cookieAna);
      expect(res.status, rota).toBe(200);

      const corpo = await res.text();
      expect(corpo, `${rota} não devolveu erro`).not.toMatch(/"error"/);
    }

    // O painel do Personal também segue de pé.
    expect((await get("/api/personal/dashboard", cookiePersonal)).status).toBe(200);
    expect(
      (await get(`/api/personal/alunos/${ana.alunoProfile.id}`, cookiePersonal)).status
    ).toBe(200);
  });

  it("no banco, o vínculo virou nulo em vez de levar o registro junto", async () => {
    const registro = await prisma.historicoTreino.findUniqueOrThrow({
      where: { id: execucaoId },
      include: { itens: true },
    });

    expect(registro.treinoId).toBeNull();
    expect(registro.treinoNome).toBe("Treino A · Superior");
    expect(registro.itens).toHaveLength(2);
  });

  it("a evolução por exercício continua contando o que foi feito", async () => {
    const res = await get("/api/aluno/progresso", cookieAna);
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.resumo.totalConcluidos).toBe(1);

    // A carga registrada continua alimentando o gráfico do exercício.
    const supino = corpo.exercicios?.find(
      (item: { nome: string }) => item.nome === "Supino reto"
    );
    expect(supino, "o exercício continua no progresso").toBeTruthy();
  });
});
