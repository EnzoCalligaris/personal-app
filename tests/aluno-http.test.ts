import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC, diaSemanaDeDataUTC, hojeUTC, paraISO, somarDiasUTC } from "@/lib/date-utils";
import { instanteDeParede } from "@/lib/fuso";
import type {
  AlunoDashboardResponse,
  MeuPerfil,
  MeusFeedbacksResponse,
  MeusTreinosResponse,
  MeuTreinoDetalhe,
  MinhaAgendaResponse,
  MinhaEvolucaoResponse,
} from "@/types/aluno-area";
import { resetDb } from "./db";
import {
  createAgendamento,
  createAluno,
  createAvaliacao,
  createExercicio,
  createFeedback,
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

/**
 * "X dias depois de hoje", como data de calendário da aplicação.
 *
 * O dia de partida é o de São Paulo, não o do relógio de quem roda a suíte:
 * com o processo em UTC ou em Tóquio, a partir das 21h "hoje" já seria o dia
 * seguinte e os fixtures cairiam na data errada.
 */
function diaEmDias(dias: number): string {
  return paraISO(somarDiasUTC(hojeUTC(), dias));
}

/** O mesmo dia, ancorado para gravar numa coluna DATE. */
function dataEmDias(dias: number): Date {
  return dataUTC(diaEmDias(dias));
}

/** Um instante de verdade: a hora de parede `hora` daquele dia, em São Paulo. */
function instanteEmDias(dias: number, hora = 12): Date {
  return instanteDeParede(diaEmDias(dias), `${String(hora).padStart(2, "0")}:00`);
}

const hoje = diaSemanaDeDataUTC(hojeUTC());

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;

let treinoDaAna = { id: "" };
let treinoDoBruno = { id: "" };

let cookieAna = "";
let cookieBruno = "";
let cookiePersonal = "";

/**
 * Cenário: dois alunos do MESMO Personal. Tudo que a Ana pede tem que voltar
 * só com o que é dela - o Bruno existe justamente para provar que os dados
 * de um aluno não vazam para o outro.
 */
beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });

  const supino = await createExercicio(personal.personalProfile.id, { nome: "Supino reto" });
  const remada = await createExercicio(personal.personalProfile.id, { nome: "Remada curvada" });

  treinoDaAna = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A · Superior",
    exercicios: [
      { exercicioId: supino.id, ordem: 1, series: 4, repeticoes: "8-10", carga: "40kg", descansoSeg: 60 },
      { exercicioId: remada.id, ordem: 2, series: 3, repeticoes: "12", descansoSeg: 90 },
    ],
  });

  treinoDoBruno = await createTreino(personal.personalProfile.id, bruno.alunoProfile.id, {
    nome: "Full body do Bruno",
    exercicios: [{ exercicioId: supino.id, ordem: 1, series: 3, repeticoes: "10" }],
  });

  // A Ana treina hoje; o Bruno também, mas com a ficha dele.
  await createProgramacao(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Bloco de hipertrofia",
    dataInicio: dataEmDias(-7),
    dias: [{ diaSemana: hoje, treinoId: treinoDaAna.id }],
  });
  await createProgramacao(personal.personalProfile.id, bruno.alunoProfile.id, {
    dataInicio: dataEmDias(-7),
    dias: [{ diaSemana: hoje, treinoId: treinoDoBruno.id }],
  });

  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(0),
    horaInicio: "18:00",
    horaFim: "19:00",
  });
  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(2),
    horaInicio: "08:00",
    horaFim: "09:00",
  });
  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(-2),
    horaInicio: "08:00",
    horaFim: "09:00",
    status: "REALIZADO",
  });
  await createAgendamento(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: dataEmDias(1),
    horaInicio: "07:00",
    horaFim: "08:00",
  });

  const avaliacaoAntiga = await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(-60),
    peso: 65.2,
    percentualGordura: 27.3,
  });
  await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(-5),
    peso: 62.4,
    percentualGordura: 24.1,
  });
  await createAvaliacao(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: dataEmDias(-4),
    peso: 81.2,
  });

  await createFeedback(personal.personalProfile.id, ana.alunoProfile.id, {
    texto: "Primeiro ciclo fechado, ótima constância.",
    avaliacaoId: avaliacaoAntiga.id,
    createdAt: instanteEmDias(-30),
  });
  await createFeedback(personal.personalProfile.id, ana.alunoProfile.id, {
    texto: "Aumentar a carga do supino na próxima semana.",
    createdAt: instanteEmDias(-1),
  });
  await createFeedback(personal.personalProfile.id, bruno.alunoProfile.id, {
    texto: "Feedback do Bruno - a Ana não pode ver isto.",
  });

  cookieAna = (await login(ana.user.email, SENHA)).cookie;
  cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const ROTAS = [
  "/api/aluno/dashboard",
  "/api/aluno/treinos",
  "/api/aluno/agenda",
  "/api/aluno/evolucao",
  "/api/aluno/feedbacks",
  "/api/aluno/perfil",
];

describe("Área do aluno - autorização", () => {
  it("exige autenticação em todas as rotas", async () => {
    for (const rota of ROTAS) {
      expect((await get(rota)).status, rota).toBe(401);
    }
  });

  it("nega acesso a um Personal (área exclusiva do aluno)", async () => {
    for (const rota of ROTAS) {
      expect((await get(rota, cookiePersonal)).status, rota).toBe(403);
    }
  });

  it("continua negando ao aluno os endpoints administrativos", async () => {
    expect((await get("/api/personal/dashboard", cookieAna)).status).toBe(403);
    expect((await get("/api/personal/alunos", cookieAna)).status).toBe(403);
  });
});

describe("Dashboard do aluno", () => {
  it("traz o treino de hoje com exercícios, duração e horário", async () => {
    const res = await get("/api/aluno/dashboard", cookieAna);
    const data = (await res.json()) as AlunoDashboardResponse;

    expect(res.status).toBe(200);
    expect(data.aluno.primeiroNome).toBe("Ana");
    expect(data.hoje.tipo).toBe("TREINO");
    expect(data.hoje.treino?.nome).toBe("Treino A · Superior");
    expect(data.hoje.treino?.totalExercicios).toBe(2);
    // 4x(45+60) + 3x(45+90) = 825s -> 13,75 min + 5 de sobrecarga -> 20 min.
    expect(data.hoje.treino?.duracaoMin).toBe(20);
    expect(data.hoje.agendamento?.horaInicio).toBe("18:00");
    expect(data.hoje.executado).toBe(false);
  });

  it("traz o próximo treino com data e horário", async () => {
    const data = (await (await get("/api/aluno/dashboard", cookieAna)).json()) as AlunoDashboardResponse;

    // A programação prescreve o mesmo dia da semana: o próximo é daqui a 7 dias.
    expect(data.proximo?.tipo).toBe("TREINO");
    expect(data.proximo?.treino?.nome).toBe("Treino A · Superior");
    expect(new Date(`${data.proximo!.data}T12:00:00Z`).getTime()).toBeGreaterThan(Date.now());
  });

  it("resume evolução e último feedback do próprio aluno", async () => {
    const data = (await (await get("/api/aluno/dashboard", cookieAna)).json()) as AlunoDashboardResponse;

    expect(data.evolucao.ultima?.peso).toBe(62.4);
    expect(data.evolucao.peso?.atual).toBe(62.4);
    expect(data.evolucao.peso?.anterior).toBe(65.2);
    expect(data.evolucao.peso?.variacao).toBe(-2.8);

    expect(data.ultimoFeedback?.texto).toBe("Aumentar a carga do supino na próxima semana.");
    expect(data.ultimoFeedback?.personal?.nome).toBe("Carlos Personal");
    expect(data.personal?.nome).toBe("Carlos Personal");
  });

  it("dá a cada aluno o seu próprio dia", async () => {
    const doBruno = (await (
      await get("/api/aluno/dashboard", cookieBruno)
    ).json()) as AlunoDashboardResponse;

    expect(doBruno.aluno.primeiroNome).toBe("Bruno");
    expect(doBruno.hoje.treino?.nome).toBe("Full body do Bruno");
    // O feedback dele é outro, e a Ana não aparece em lugar nenhum.
    expect(doBruno.ultimoFeedback?.texto).toContain("Bruno");
    expect(doBruno.evolucao.avaliacoes).toHaveLength(1);
  });
});

describe("Treinos do aluno", () => {
  it("lista apenas as próprias fichas", async () => {
    const res = await get("/api/aluno/treinos", cookieAna);
    const data = (await res.json()) as MeusTreinosResponse;

    expect(res.status).toBe(200);
    expect(data.treinos.map((treino) => treino.nome)).toEqual(["Treino A · Superior"]);
    expect(data.treinos[0].diasProgramados).toEqual([hoje]);
    expect(data.historico).toHaveLength(0);
  });

  it("abre a ficha completa com séries, carga e descanso", async () => {
    const res = await get(`/api/aluno/treinos/${treinoDaAna.id}`, cookieAna);
    const treino = (await res.json()) as MeuTreinoDetalhe;

    expect(res.status).toBe(200);
    expect(treino.exercicios).toHaveLength(2);
    expect(treino.exercicios[0].exercicio.nome).toBe("Supino reto");
    expect(treino.exercicios[0].series).toBe(4);
    expect(treino.exercicios[0].carga).toBe("40kg");
    expect(treino.exercicios[1].descansoSeg).toBe(90);
  });

  it("NÃO abre a ficha de outro aluno (404, não 403)", async () => {
    const res = await get(`/api/aluno/treinos/${treinoDoBruno.id}`, cookieAna);
    expect(res.status).toBe(404);
  });

  it("NÃO registra execução no treino de outro aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/treinos/${treinoDoBruno.id}/execucoes`,
      comCookie(cookieAna, { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(404);

    // E nada foi gravado no histórico de nenhum dos dois.
    const gravados = await prisma.historicoTreino.count({
      where: { alunoId: { in: [ana.alunoProfile.id, bruno.alunoProfile.id] } },
    });
    expect(gravados).toBe(0);
  });

  it("registra a execução do próprio treino e alimenta o histórico", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/treinos/${treinoDaAna.id}/execucoes`,
      comCookie(cookieAna, {
        method: "POST",
        body: JSON.stringify({ observacoes: "Subi a carga do supino." }),
      })
    );
    const execucao = await res.json();

    expect(res.status).toBe(201);
    expect(execucao.treino.nome).toBe("Treino A · Superior");
    expect(execucao.concluido).toBe(true);

    const treinos = (await (
      await get("/api/aluno/treinos", cookieAna)
    ).json()) as MeusTreinosResponse;
    expect(treinos.historico).toHaveLength(1);
    expect(treinos.historico[0].observacoes).toBe("Subi a carga do supino.");
    expect(treinos.treinos[0].ultimaExecucao).toBeTruthy();

    // O dashboard passa a mostrar o dia como concluído.
    const dashboard = (await (
      await get("/api/aluno/dashboard", cookieAna)
    ).json()) as AlunoDashboardResponse;
    expect(dashboard.hoje.executado).toBe(true);
    expect(dashboard.resumo.totalExecucoes).toBe(1);
    expect(dashboard.resumo.concluidosNaSemana).toBe(1);
    expect(dashboard.resumo.sequencia).toBeGreaterThanOrEqual(1);

    // O histórico do Bruno continua vazio.
    const doBruno = (await (
      await get("/api/aluno/treinos", cookieBruno)
    ).json()) as MeusTreinosResponse;
    expect(doBruno.historico).toHaveLength(0);
  });

  it("valida as observações da execução", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/treinos/${treinoDaAna.id}/execucoes`,
      comCookie(cookieAna, {
        method: "POST",
        body: JSON.stringify({ observacoes: "x".repeat(501) }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("Agenda do aluno", () => {
  it("separa próximos e anteriores, só dele", async () => {
    const res = await get("/api/aluno/agenda", cookieAna);
    const data = (await res.json()) as MinhaAgendaResponse;

    expect(res.status).toBe(200);
    expect(data.personal?.nome).toBe("Carlos Personal");
    expect(data.proximos.some((item) => item.horaInicio === "08:00")).toBe(true);
    expect(data.anteriores.some((item) => item.status === "REALIZADO")).toBe(true);

    // O agendamento do Bruno (07:00) não aparece na agenda da Ana.
    const todos = [...data.proximos, ...data.anteriores];
    expect(todos.some((item) => item.horaInicio === "07:00")).toBe(false);
  });

  it("mostra ao Bruno apenas o horário dele", async () => {
    const data = (await (await get("/api/aluno/agenda", cookieBruno)).json()) as MinhaAgendaResponse;
    expect(data.proximos).toHaveLength(1);
    expect(data.proximos[0].horaInicio).toBe("07:00");
  });
});

describe("Evolução do aluno", () => {
  it("devolve as avaliações do próprio aluno em ordem e com as variações", async () => {
    const res = await get("/api/aluno/evolucao", cookieAna);
    const data = (await res.json()) as MinhaEvolucaoResponse;

    expect(res.status).toBe(200);
    expect(data.avaliacoes).toHaveLength(2);
    expect(data.avaliacoes[0].peso).toBe(65.2);
    expect(data.avaliacoes[1].peso).toBe(62.4);
    expect(data.percentualGordura?.variacao).toBe(-3.2);
    expect(data.ultima?.peso).toBe(62.4);
  });

  it("não mistura avaliações de outro aluno", async () => {
    const data = (await (
      await get("/api/aluno/evolucao", cookieBruno)
    ).json()) as MinhaEvolucaoResponse;

    expect(data.avaliacoes).toHaveLength(1);
    expect(data.avaliacoes[0].peso).toBe(81.2);
  });
});

describe("Feedbacks do aluno", () => {
  it("lista só os feedbacks dele, do mais recente para o mais antigo", async () => {
    const res = await get("/api/aluno/feedbacks", cookieAna);
    const data = (await res.json()) as MeusFeedbacksResponse;

    expect(res.status).toBe(200);
    expect(data.feedbacks).toHaveLength(2);
    expect(data.feedbacks[0].texto).toBe("Aumentar a carga do supino na próxima semana.");
    expect(data.feedbacks[1].avaliacao).toBeTruthy();
    expect(data.feedbacks.some((item) => item.texto.includes("Bruno"))).toBe(false);
  });
});

describe("Perfil do aluno", () => {
  it("devolve os próprios dados", async () => {
    const res = await get("/api/aluno/perfil", cookieAna);
    const perfil = (await res.json()) as MeuPerfil;

    expect(res.status).toBe(200);
    expect(perfil.nome).toBe("Ana Aluna");
    expect(perfil.email).toBe(ana.user.email);
    expect(perfil.personal?.nome).toBe("Carlos Personal");
  });

  it("edita nome, telefone, altura e objetivo", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/perfil`,
      comCookie(cookieAna, {
        method: "PATCH",
        body: JSON.stringify({
          nome: "Ana Aluna Silva",
          telefone: "(11) 91234-5678",
          altura: 168,
          objetivo: "Hipertrofia",
          dataNascimento: "1995-06-15",
        }),
      })
    );
    const perfil = (await res.json()) as MeuPerfil;

    expect(res.status).toBe(200);
    expect(perfil.nome).toBe("Ana Aluna Silva");
    expect(perfil.telefone).toBe("(11) 91234-5678");
    expect(perfil.altura).toBe(168);
    expect(perfil.objetivo).toBe("Hipertrofia");
    expect(perfil.dataNascimento?.slice(0, 10)).toBe("1995-06-15");
  });

  it("ignora campos que não são do aluno (e-mail, status, vínculo)", async () => {
    const outroPersonal = await createPersonal({ name: "Personal Rival" });

    const res = await fetch(
      `${BASE_URL}/api/aluno/perfil`,
      comCookie(cookieAna, {
        method: "PATCH",
        body: JSON.stringify({
          email: "invadido@example.com",
          status: "INATIVO",
          personalId: outroPersonal.personalProfile.id,
        }),
      })
    );
    expect(res.status).toBe(200);

    const perfil = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: ana.alunoProfile.id },
      include: { user: { select: { email: true } } },
    });
    expect(perfil.user.email).toBe(ana.user.email);
    expect(perfil.status).toBe("ATIVO");
    expect(perfil.personalId).toBe(personal.personalProfile.id);
  });

  it("valida os dados enviados", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/perfil`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ nome: "A", altura: 12 }) })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.nome).toBeTruthy();
    expect(body.issues.altura).toBeTruthy();
  });

  it("um aluno não altera o perfil de outro (não há id na rota)", async () => {
    // A rota do Personal continua barrada para o aluno...
    const viaAdmin = await fetch(
      `${BASE_URL}/api/personal/alunos/${bruno.alunoProfile.id}`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ name: "Invadido" }) })
    );
    expect(viaAdmin.status).toBe(403);

    // ...e o endpoint público de aluno responde 404 para o perfil do Bruno.
    const viaAluno = await get(`/api/alunos/${bruno.alunoProfile.id}`, cookieAna);
    expect(viaAluno.status).toBe(404);

    const intacto = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: bruno.alunoProfile.id },
      include: { user: { select: { name: true } } },
    });
    expect(intacto.user.name).toBe("Bruno Aluno");
  });
});
