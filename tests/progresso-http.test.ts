import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { DIAS_SEMANA } from "@/lib/date-utils";
import type { ProgressoResponse } from "@/types/aluno-area";
import { resetDb } from "./db";
import {
  createAluno,
  createExecucao,
  createExercicio,
  createPersonal,
  createProgramacao,
  createTreino,
} from "./factories";
import { get, login, SENHA } from "./http";

function emDias(dias: number, hora = 12) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
/** Aluno sem nenhuma execução, para o estado vazio. */
let novato: Awaited<ReturnType<typeof createAluno>>;

let cookieAna = "";
let cookieBruno = "";
let cookieNovato = "";
let cookiePersonal = "";

let supino = { id: "" };

/**
 * Cenário da Ana: quatro treinos registrados. Nos dois mais antigos a carga do
 * supino sobe (20 -> 22 -> 25), e os dois últimos são em dias seguidos (ontem
 * e hoje), formando uma sequência.
 */
beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });
  novato = await createAluno({ name: "Novato Sem Treino", personalId: personal.personalProfile.id });

  supino = await createExercicio(personal.personalProfile.id, { nome: "Supino reto" });
  const flexao = await createExercicio(personal.personalProfile.id, { nome: "Flexão de braço" });

  const treinoDaAna = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A · Superior",
    exercicios: [{ exercicioId: supino.id, ordem: 1, series: 4, repeticoes: "8-10", carga: "20kg" }],
  });
  const treinoDoBruno = await createTreino(personal.personalProfile.id, bruno.alunoProfile.id, {
    nome: "Full body do Bruno",
    exercicios: [{ exercicioId: supino.id, ordem: 1, series: 3, repeticoes: "10", carga: "60kg" }],
  });

  // Todos os dias são dia de treino: assim a sequência não depende do dia da
  // semana em que a suíte roda.
  await createProgramacao(personal.personalProfile.id, ana.alunoProfile.id, {
    dataInicio: emDias(-60),
    dias: DIAS_SEMANA.map((diaSemana) => ({ diaSemana, treinoId: treinoDaAna.id })),
  });

  const itemSupino = (carga: string) => ({
    exercicioId: supino.id,
    nome: "Supino reto",
    grupoMuscular: "Peito",
    series: 4,
    repeticoes: "8-10",
    carga,
  });

  await createExecucao(treinoDaAna.id, ana.alunoProfile.id, {
    dataExecucao: emDias(-10),
    duracaoSeg: 3000,
    itens: [itemSupino("20kg")],
  });
  await createExecucao(treinoDaAna.id, ana.alunoProfile.id, {
    dataExecucao: emDias(-6),
    duracaoSeg: 3200,
    itens: [itemSupino("22kg")],
  });
  await createExecucao(treinoDaAna.id, ana.alunoProfile.id, {
    dataExecucao: emDias(-1),
    duracaoSeg: 3100,
    itens: [
      itemSupino("25kg"),
      // Sem carga numérica: entra no histórico, mas não vira gráfico.
      {
        exercicioId: flexao.id,
        nome: "Flexão de braço",
        grupoMuscular: "Peito",
        series: 3,
        repeticoes: "15",
        carga: "peso corporal",
      },
    ],
  });
  await createExecucao(treinoDaAna.id, ana.alunoProfile.id, {
    dataExecucao: emDias(0, 7),
    duracaoSeg: 2900,
    itens: [itemSupino("27kg")],
  });

  await createExecucao(treinoDoBruno.id, bruno.alunoProfile.id, {
    dataExecucao: emDias(-2),
    itens: [{ exercicioId: supino.id, nome: "Supino reto", carga: "60kg" }],
  });

  cookieAna = (await login(ana.user.email, SENHA)).cookie;
  cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
  cookieNovato = (await login(novato.user.email, SENHA)).cookie;
  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Evolução dos treinos - autorização", () => {
  it("exige sessão de aluno", async () => {
    expect((await get("/api/aluno/progresso")).status).toBe(401);
    expect((await get("/api/aluno/progresso", cookiePersonal)).status).toBe(403);
  });
});

describe("Evolução por exercício", () => {
  it("mostra a progressão de carga do exercício, treino a treino", async () => {
    const res = await get("/api/aluno/progresso", cookieAna);
    const data = (await res.json()) as ProgressoResponse;

    expect(res.status).toBe(200);

    const supinoEvolucao = data.exercicios.find((item) => item.nome === "Supino reto");
    expect(supinoEvolucao).toBeTruthy();
    expect(supinoEvolucao!.sessoes).toBe(4);
    // 20kg -> 22kg -> 25kg -> 27kg
    expect(supinoEvolucao!.registros.map((registro) => registro.cargaKg)).toEqual([20, 22, 25, 27]);
    expect(supinoEvolucao!.cargaInicial).toBe(20);
    expect(supinoEvolucao!.cargaAtual).toBe(27);
    expect(supinoEvolucao!.variacaoKg).toBe(7);
    expect(supinoEvolucao!.variacaoPercentual).toBe(35);
    expect(supinoEvolucao!.temGrafico).toBe(true);

    // As datas vêm em ordem, para o gráfico não precisar reordenar.
    const datas = supinoEvolucao!.registros.map((registro) => registro.data);
    expect([...datas].sort()).toEqual(datas);
  });

  it("mantém no histórico o exercício sem carga numérica, mas sem gráfico", async () => {
    const data = (await (await get("/api/aluno/progresso", cookieAna)).json()) as ProgressoResponse;

    const flexao = data.exercicios.find((item) => item.nome === "Flexão de braço");
    expect(flexao?.sessoes).toBe(1);
    expect(flexao?.registros[0].carga).toBe("peso corporal");
    expect(flexao?.registros[0].cargaKg).toBeNull();
    // Um único registro (e sem número) não vira evolução.
    expect(flexao?.temGrafico).toBe(false);
    expect(flexao?.cargaInicial).toBeNull();
  });

  it("não mistura a carga de outro aluno no mesmo exercício", async () => {
    const doBruno = (await (
      await get("/api/aluno/progresso", cookieBruno)
    ).json()) as ProgressoResponse;

    const supinoDoBruno = doBruno.exercicios.find((item) => item.nome === "Supino reto");
    expect(supinoDoBruno!.registros.map((registro) => registro.cargaKg)).toEqual([60]);
    expect(supinoDoBruno!.temGrafico).toBe(false);
  });
});

describe("Treinos concluídos, frequência e sequência", () => {
  it("conta os treinos concluídos e a frequência semanal", async () => {
    const data = (await (await get("/api/aluno/progresso", cookieAna)).json()) as ProgressoResponse;

    expect(data.resumo.totalConcluidos).toBe(4);
    expect(data.resumo.frequenciaSemanal).toBeGreaterThan(0);
    expect(data.resumo.primeiroTreino).toBeTruthy();

    expect(data.semanas).toHaveLength(12);
    // A semana atual é a última do array e tem pelo menos o treino de hoje.
    expect(data.semanas.at(-1)!.realizados).toBeGreaterThanOrEqual(1);
    // Com programação todo dia, a semana atual prevê 7 treinos.
    expect(data.semanas.at(-1)!.previstos).toBe(7);
    // A soma bate com os treinos das últimas 12 semanas.
    expect(data.semanas.reduce((total, semana) => total + semana.realizados, 0)).toBe(4);
  });

  it("calcula a sequência atual e a melhor sequência", async () => {
    const data = (await (await get("/api/aluno/progresso", cookieAna)).json()) as ProgressoResponse;

    // Ontem e hoje, dois dias seguidos de treino previsto e feito.
    expect(data.resumo.sequenciaAtual).toBe(2);
    expect(data.resumo.melhorSequencia).toBe(2);
  });

  it("traz previsto x realizado das últimas semanas", async () => {
    const data = (await (await get("/api/aluno/progresso", cookieAna)).json()) as ProgressoResponse;

    expect(data.resumo.aderencia).toBeTruthy();
    expect(data.resumo.aderencia!.previstos).toBe(28);
    expect(data.resumo.aderencia!.realizados).toBeGreaterThanOrEqual(3);
  });

  it("não devolve aderência para quem não tem programação", async () => {
    const doBruno = (await (
      await get("/api/aluno/progresso", cookieBruno)
    ).json()) as ProgressoResponse;

    expect(doBruno.resumo.aderencia).toBeNull();
    // Sem programação, nenhum dia é "dia de treino" - a sequência fica zerada.
    expect(doBruno.resumo.sequenciaAtual).toBe(0);
    expect(doBruno.resumo.totalConcluidos).toBe(1);
  });
});

describe("Aluno sem treinos", () => {
  it("responde vazio, sem inventar números", async () => {
    const res = await get("/api/aluno/progresso", cookieNovato);
    const data = (await res.json()) as ProgressoResponse;

    expect(res.status).toBe(200);
    expect(data.resumo.totalConcluidos).toBe(0);
    expect(data.resumo.frequenciaSemanal).toBe(0);
    expect(data.resumo.sequenciaAtual).toBe(0);
    expect(data.resumo.melhorSequencia).toBe(0);
    expect(data.resumo.primeiroTreino).toBeNull();
    expect(data.exercicios).toEqual([]);
    // As semanas existem, mas todas zeradas - a tela mostra o estado vazio.
    expect(data.semanas).toHaveLength(12);
    expect(data.semanas.every((semana) => semana.realizados === 0)).toBe(true);
  });
});
