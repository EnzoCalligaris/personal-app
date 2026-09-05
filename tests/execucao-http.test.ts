import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type {
  ExecucaoRegistrada,
  MeuHistoricoResponse,
  MeusTreinosResponse,
} from "@/types/aluno-area";
import { resetDb } from "./db";
import { createAluno, createExercicio, createPersonal, createTreino } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;

let treinoDaAna = { id: "" };
let treinoDoBruno = { id: "" };
/** Itens (treino_exercicios) da ficha da Ana, na ordem. */
let itensDaAna: { id: string; nome: string }[] = [];
let itemDoBruno = { id: "" };

let cookieAna = "";
let cookieBruno = "";
let cookiePersonal = "";

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });

  const supino = await createExercicio(personal.personalProfile.id, { nome: "Supino reto" });
  const remada = await createExercicio(personal.personalProfile.id, { nome: "Remada curvada" });
  const agachamento = await createExercicio(personal.personalProfile.id, {
    nome: "Agachamento livre",
  });

  treinoDaAna = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A · Superior",
    exercicios: [
      { exercicioId: supino.id, ordem: 1, series: 4, repeticoes: "8-10", carga: "40kg", descansoSeg: 60 },
      { exercicioId: remada.id, ordem: 2, series: 3, repeticoes: "12", carga: "35kg" },
      { exercicioId: agachamento.id, ordem: 3, series: 3, repeticoes: "10", descansoSeg: 90 },
    ],
  });

  treinoDoBruno = await createTreino(personal.personalProfile.id, bruno.alunoProfile.id, {
    nome: "Full body do Bruno",
    exercicios: [{ exercicioId: supino.id, ordem: 1, series: 3, repeticoes: "10" }],
  });

  itensDaAna = await prisma.treinoExercicio.findMany({
    where: { treinoId: treinoDaAna.id },
    orderBy: { ordem: "asc" },
    select: { id: true, exercicio: { select: { nome: true } } },
  }).then((itens) => itens.map((item) => ({ id: item.id, nome: item.exercicio.nome })));

  itemDoBruno = await prisma.treinoExercicio.findFirstOrThrow({
    where: { treinoId: treinoDoBruno.id },
    select: { id: true },
  });

  cookieAna = (await login(ana.user.email, SENHA)).cookie;
  cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

function registrar(cookie: string, treinoId: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/aluno/treinos/${treinoId}/execucoes`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

describe("Sessão de treino - autorização", () => {
  it("exige sessão de aluno", async () => {
    const semLogin = await fetch(`${BASE_URL}/api/aluno/treinos/${treinoDaAna.id}/execucoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(semLogin.status).toBe(401);

    const comoPersonal = await registrar(cookiePersonal, treinoDaAna.id, {});
    expect(comoPersonal.status).toBe(403);

    expect((await get("/api/aluno/historico")).status).toBe(401);
    expect((await get("/api/aluno/historico", cookiePersonal)).status).toBe(403);
  });

  it("NÃO registra execução no treino de outro aluno", async () => {
    const res = await registrar(cookieAna, treinoDoBruno.id, {});
    expect(res.status).toBe(404);
  });

  it("NÃO aceita exercício que não é da ficha", async () => {
    const res = await registrar(cookieAna, treinoDaAna.id, {
      itens: [{ treinoExercicioId: itemDoBruno.id, concluido: true }],
    });
    expect(res.status).toBe(400);

    // Nada gravado para nenhum dos dois.
    const gravados = await prisma.historicoTreino.count({
      where: { alunoId: { in: [ana.alunoProfile.id, bruno.alunoProfile.id] } },
    });
    expect(gravados).toBe(0);
  });
});

describe("Registro do que foi realizado", () => {
  let execucao: ExecucaoRegistrada;

  it("grava data, treino, duração e cada exercício com séries, repetições e carga", async () => {
    const res = await registrar(cookieAna, treinoDaAna.id, {
      duracaoSeg: 2730,
      observacoes: "Subi a carga do supino.",
      itens: [
        // Supino: fez as 4 séries com carga maior do que a prescrita.
        {
          treinoExercicioId: itensDaAna[0].id,
          concluido: true,
          series: 4,
          repeticoes: "8",
          carga: "45kg",
        },
        // Remada: parou na segunda série.
        {
          treinoExercicioId: itensDaAna[1].id,
          concluido: false,
          series: 2,
          repeticoes: "12",
        },
        // Agachamento: fez como prescrito (sem ajuste de carga).
        { treinoExercicioId: itensDaAna[2].id, concluido: true, series: 3 },
      ],
    });
    execucao = (await res.json()) as ExecucaoRegistrada;

    expect(res.status).toBe(201);
    expect(execucao.treino.nome).toBe("Treino A · Superior");
    expect(execucao.duracaoSeg).toBe(2730);
    expect(execucao.observacoes).toBe("Subi a carga do supino.");
    expect(new Date(execucao.data).getTime()).toBeLessThanOrEqual(Date.now());

    expect(execucao.itens).toHaveLength(3);
    expect(execucao.totalExercicios).toBe(3);
    expect(execucao.exerciciosConcluidos).toBe(2);
    // Só as séries dos exercícios concluídos entram no total: 4 + 3.
    expect(execucao.totalSeries).toBe(7);

    const supino = execucao.itens[0];
    expect(supino.nome).toBe("Supino reto");
    expect(supino.grupoMuscular).toBe("Peito");
    expect(supino.series).toBe(4);
    expect(supino.repeticoes).toBe("8");
    expect(supino.carga).toBe("45kg");
    expect(supino.concluido).toBe(true);

    const remada = execucao.itens[1];
    expect(remada.concluido).toBe(false);
    expect(remada.series).toBe(2);
    // Sem ajuste de carga, vale o que estava prescrito.
    expect(remada.carga).toBe("35kg");

    const agachamento = execucao.itens[2];
    expect(agachamento.repeticoes).toBe("10");
    expect(agachamento.carga).toBeNull();
  });

  it("registra a ficha inteira quando não vêm itens (marcar como feito)", async () => {
    const res = await registrar(cookieBruno, treinoDoBruno.id, {});
    const doBruno = (await res.json()) as ExecucaoRegistrada;

    expect(res.status).toBe(201);
    expect(doBruno.itens).toHaveLength(1);
    expect(doBruno.itens[0].nome).toBe("Supino reto");
    expect(doBruno.itens[0].series).toBe(3);
    expect(doBruno.duracaoSeg).toBeNull();
  });

  it("valida duração e observações", async () => {
    const duracaoAbsurda = await registrar(cookieAna, treinoDaAna.id, { duracaoSeg: 999999 });
    expect(duracaoAbsurda.status).toBe(400);

    const observacaoLonga = await registrar(cookieAna, treinoDaAna.id, {
      observacoes: "x".repeat(501),
    });
    expect(observacaoLonga.status).toBe(400);
  });

  it("mantém o registro mesmo se a ficha mudar depois", async () => {
    // O Personal renomeia o exercício e remove um item da ficha.
    await prisma.exercicio.updateMany({
      // Escopado ao Personal do teste: a biblioteca de outros (inclusive a do
      // seed de desenvolvimento) não pode ser tocada por um teste.
      where: { personalId: personal.personalProfile.id, nome: "Supino reto" },
      data: { nome: "Supino reto (renomeado)" },
    });
    await prisma.treinoExercicio.delete({ where: { id: itensDaAna[2].id } });

    const historico = (await (
      await get("/api/aluno/historico", cookieAna)
    ).json()) as MeuHistoricoResponse;

    const registrada = historico.execucoes.find((item) => item.id === execucao.id);
    // O retrato do momento continua o mesmo.
    expect(registrada?.itens[0].nome).toBe("Supino reto");
    expect(registrada?.itens).toHaveLength(3);
  });
});

describe("Histórico do aluno", () => {
  it("lista as execuções do próprio aluno com resumo", async () => {
    const res = await get("/api/aluno/historico", cookieAna);
    const data = (await res.json()) as MeuHistoricoResponse;

    expect(res.status).toBe(200);
    expect(data.execucoes).toHaveLength(1);
    expect(data.resumo.total).toBe(1);
    expect(data.resumo.noMes).toBe(1);
    // 2730s = 45,5 min -> 46.
    expect(data.resumo.minutosTotais).toBe(46);
  });

  it("não mostra a um aluno o treino do outro", async () => {
    const data = (await (
      await get("/api/aluno/historico", cookieBruno)
    ).json()) as MeuHistoricoResponse;

    expect(data.execucoes).toHaveLength(1);
    expect(data.execucoes[0].treino.nome).toBe("Full body do Bruno");
  });

  it("aparece também no resumo da tela de treinos", async () => {
    const data = (await (
      await get("/api/aluno/treinos", cookieAna)
    ).json()) as MeusTreinosResponse;

    expect(data.historico[0].exerciciosConcluidos).toBe(2);
    expect(data.historico[0].duracaoSeg).toBe(2730);
  });

  it("some junto com o treino quando a ficha é excluída", async () => {
    await prisma.treino.delete({ where: { id: treinoDaAna.id } });

    const data = (await (
      await get("/api/aluno/historico", cookieAna)
    ).json()) as MeuHistoricoResponse;
    expect(data.execucoes).toHaveLength(0);

    // E os itens do histórico foram junto (cascata), sem deixar órfãos - só
    // sobrou a execução do Bruno.
    const itensRestantes = await prisma.historicoExercicio.count({
      where: { historico: { alunoId: { in: [ana.alunoProfile.id, bruno.alunoProfile.id] } } },
    });
    expect(itensRestantes).toBe(1);
  });
});
