import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC, diaSemanaDeDataUTC, hojeUTC, paraISO, somarDiasUTC } from "@/lib/date-utils";
import { instanteDeParede } from "@/lib/fuso";
import type { DashboardData } from "@/types/dashboard";
import { resetDb } from "./db";
import {
  createAgendamento,
  createAluno,
  createAvaliacao,
  createHistorico,
  createPersonal,
  createProgramacao,
  createTreino,
} from "./factories";
import { get, login, SENHA } from "./http";

/**
 * "X dias depois de hoje", como data de calendário da aplicação.
 *
 * O dia de partida é o de São Paulo, não o do relógio de quem roda a suíte:
 * com o processo em UTC ou em Tóquio, a partir das 21h "hoje" já seria o dia
 * seguinte e os fixtures cairiam na data errada.
 */
function diaEmDias(dias: number, agora = new Date()): string {
  return paraISO(somarDiasUTC(hojeUTC(agora), dias));
}

/** O mesmo dia, ancorado para gravar numa coluna DATE. */
function dataEmDias(dias: number, agora = new Date()): Date {
  return dataUTC(diaEmDias(dias, agora));
}

/** Um instante de verdade: a hora de parede `hora` daquele dia, em São Paulo. */
function instanteEmDias(dias: number, hora = 12): Date {
  return instanteDeParede(diaEmDias(dias), `${String(hora).padStart(2, "0")}:00`);
}

const hoje = diaSemanaDeDataUTC(hojeUTC());
const amanha = diaSemanaDeDataUTC(dataEmDias(1));

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

/**
 * Cenário montado no banco (todos os registros pertencem a `personal`, exceto
 * os do `outroPersonal`, usados para provar o isolamento):
 *  - 2 alunos, sendo 1 com treino ativo hoje e execução recente;
 *  - 1 agendamento hoje, 1 futuro e 1 cancelado;
 *  - 1 avaliação recente e 1 antiga (fora da janela de 30 dias).
 */
beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Dashboard" });
  outroPersonal = await createPersonal({ name: "Outro Personal" });

  ana = await createAluno({ name: "Ana Dashboard", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Dashboard", personalId: personal.personalProfile.id });
  alunoDoOutro = await createAluno({
    name: "Aluno do Outro",
    personalId: outroPersonal.personalProfile.id,
  });

  const treinoDeHoje = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A · Superior",
  });
  const treinoDeAmanha = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino B · Inferior",
  });
  const treinoArquivado = await createTreino(personal.personalProfile.id, bruno.alunoProfile.id, {
    nome: "Treino arquivado",
    ativo: false,
  });

  // Os dias vêm da programação: a da Ana prescreve treino hoje e amanhã.
  await createProgramacao(personal.personalProfile.id, ana.alunoProfile.id, {
    dataInicio: dataEmDias(-7),
    dias: [
      { diaSemana: hoje, treinoId: treinoDeHoje.id },
      ...(amanha !== hoje ? [{ diaSemana: amanha, treinoId: treinoDeAmanha.id }] : []),
    ],
  });

  // O treino do Bruno cai hoje, mas está inativo - não deve contar.
  await createProgramacao(personal.personalProfile.id, bruno.alunoProfile.id, {
    dataInicio: dataEmDias(-7),
    dias: [{ diaSemana: hoje, treinoId: treinoArquivado.id }],
  });

  await createHistorico(treinoDeHoje.id, ana.alunoProfile.id, { dataExecucao: instanteEmDias(-2) });

  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(0),
    horaInicio: "08:00",
    horaFim: "09:00",
    // Já aconteceu: o dashboard só conta como "próximo" o que ainda está
    // ativo, então este não depende da hora em que a suíte roda.
    status: "REALIZADO",
  });
  await createAgendamento(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: dataEmDias(2),
    horaInicio: "18:00",
    horaFim: "19:00",
  });
  await createAgendamento(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: dataEmDias(3),
    status: "CANCELADO",
  });

  await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataEmDias(-3),
    peso: 62.4,
    percentualGordura: 24.1,
  });
  await createAvaliacao(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: dataEmDias(-45),
  });

  // Dados do outro Personal - nada disso pode aparecer no dashboard.
  const treinoDoOutro = await createTreino(
    outroPersonal.personalProfile.id,
    alunoDoOutro.alunoProfile.id
  );
  await createProgramacao(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    dataInicio: dataEmDias(-7),
    dias: [{ diaSemana: hoje, treinoId: treinoDoOutro.id }],
  });
  await createAgendamento(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    data: dataEmDias(0),
  });
  await createAvaliacao(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    data: dataEmDias(-1),
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("GET /api/personal/dashboard - autorização", () => {
  it("exige autenticação", async () => {
    const res = await get("/api/personal/dashboard");
    expect(res.status).toBe(401);
  });

  it("nega acesso a um Aluno (endpoint administrativo)", async () => {
    const { cookie } = await login(ana.user.email, SENHA);
    const res = await get("/api/personal/dashboard", cookie);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/personal/dashboard - resumo", () => {
  it("retorna os números do próprio Personal", async () => {
    const { cookie } = await login(personal.user.email, SENHA);
    const res = await get("/api/personal/dashboard", cookie);
    const data = (await res.json()) as DashboardData;

    expect(res.status).toBe(200);
    expect(data.resumo.totalAlunos).toBe(2);
    // Alunos ativos = status ATIVO (padrão ao criar).
    expect(data.resumo.alunosAtivos).toBe(2);
    // Só o treino ativo de hoje conta (o arquivado não).
    expect(data.resumo.treinosDoDia).toBe(1);
    // O cancelado não entra.
    expect(data.resumo.proximosAgendamentos).toBe(1);
    // A avaliação de 45 dias atrás está fora da janela.
    expect(data.resumo.avaliacoesRecentes).toBe(1);
    expect(data.hoje.diaSemana).toBe(hoje);
  });

  it("não mistura os dados de outro Personal", async () => {
    const { cookie } = await login(outroPersonal.user.email, SENHA);
    const res = await get("/api/personal/dashboard", cookie);
    const data = (await res.json()) as DashboardData;

    expect(data.resumo.totalAlunos).toBe(1);
    expect(data.resumo.treinosDoDia).toBe(1);
    expect(data.alunosRecentes.map((a) => a.nome)).toEqual(["Aluno do Outro"]);
    expect(data.agendaDoDia.every((item) => item.aluno.nome === "Aluno do Outro")).toBe(true);
  });
});

describe("GET /api/personal/dashboard - agenda", () => {
  it("lista os agendamentos de hoje com aluno, status e treino do dia", async () => {
    const { cookie } = await login(personal.user.email, SENHA);
    const data = (await (await get("/api/personal/dashboard", cookie)).json()) as DashboardData;

    expect(data.agendaDoDia).toHaveLength(1);
    const item = data.agendaDoDia[0];
    expect(item.aluno.nome).toBe("Ana Dashboard");
    expect(item.horaInicio).toBe("08:00");
    expect(item.horaFim).toBe("09:00");
    expect(item.status).toBe("REALIZADO");
    // "Tipo de treino" é derivado do treino programado para o dia da semana.
    expect(item.treino?.nome).toBe("Treino A · Superior");
  });

  it("separa os próximos agendamentos e ignora os cancelados", async () => {
    const { cookie } = await login(personal.user.email, SENHA);
    const data = (await (await get("/api/personal/dashboard", cookie)).json()) as DashboardData;

    expect(data.proximosAgendamentos).toHaveLength(1);
    expect(data.proximosAgendamentos[0].aluno.nome).toBe("Bruno Dashboard");
    expect(data.proximosAgendamentos.some((item) => item.status === "CANCELADO")).toBe(false);
  });
});

describe("GET /api/personal/dashboard - alunos e avaliações", () => {
  it("traz os alunos recentes com treino programado e última execução", async () => {
    const { cookie } = await login(personal.user.email, SENHA);
    const data = (await (await get("/api/personal/dashboard", cookie)).json()) as DashboardData;

    expect(data.alunosRecentes).toHaveLength(2);

    const anaResumo = data.alunosRecentes.find((a) => a.nome === "Ana Dashboard");
    expect(anaResumo?.ativo).toBe(true);
    expect(anaResumo?.totalTreinos).toBe(2);
    expect(anaResumo?.proximoTreino?.diaSemana).toBe(hoje);
    expect(anaResumo?.ultimaExecucao).toBeTruthy();

    const brunoResumo = data.alunosRecentes.find((a) => a.nome === "Bruno Dashboard");
    expect(brunoResumo?.ultimaExecucao).toBeNull();
  });

  it("lista as avaliações mais recentes primeiro", async () => {
    const { cookie } = await login(personal.user.email, SENHA);
    const data = (await (await get("/api/personal/dashboard", cookie)).json()) as DashboardData;

    expect(data.avaliacoesRecentes).toHaveLength(2);
    expect(data.avaliacoesRecentes[0].aluno.nome).toBe("Ana Dashboard");
    expect(data.avaliacoesRecentes[0].peso).toBe(62.4);
    const datas = data.avaliacoesRecentes.map((a) => new Date(a.data).getTime());
    expect(datas[0]).toBeGreaterThan(datas[1]);
  });
});

/**
 * O fixture de datas, sob o relógio que já derrubou este arquivo.
 *
 * Das 21h de São Paulo em diante o dia já virou em UTC. A versão anterior
 * montava "agora - 2 horas" e gravava esse *instante* numa coluna DATE: das
 * 23h às 02h isso registrava o dia seguinte, a agenda do dia aparecia vazia e
 * o atendimento passado era contado como próximo.
 */
describe("Fixture de datas do dashboard", () => {
  /** Hora de parede em São Paulo, o instante UTC equivalente e o dia devido. */
  const janela: [string, string, string][] = [
    ["20:59", "2026-09-06T23:59:00Z", "2026-09-06"],
    ["21:00", "2026-09-07T00:00:00Z", "2026-09-06"],
    ["23:00", "2026-09-07T02:00:00Z", "2026-09-06"],
    ["23:59", "2026-09-07T02:59:00Z", "2026-09-06"],
    ["00:00", "2026-09-07T03:00:00Z", "2026-09-07"],
    ["00:30", "2026-09-07T03:30:00Z", "2026-09-07"],
    ["01:59", "2026-09-07T04:59:00Z", "2026-09-07"],
    ["02:00", "2026-09-07T05:00:00Z", "2026-09-07"],
  ];

  it("representa o dia brasileiro em toda a janela das 21h às 02h", () => {
    for (const [hora, instante, dia] of janela) {
      expect(diaEmDias(0, new Date(instante)), `${hora} em São Paulo`).toBe(dia);
    }
  });

  it("a coluna DATE recebe esse mesmo dia, ancorado em meia-noite UTC", () => {
    for (const [hora, instante, dia] of janela) {
      expect(dataEmDias(0, new Date(instante)).toISOString(), hora).toBe(`${dia}T00:00:00.000Z`);
    }
  });

  it("e nada disso muda com o fuso do processo", () => {
    const original = process.env.TZ;
    try {
      for (const fuso of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
        process.env.TZ = fuso;
        for (const [hora, instante, dia] of janela) {
          expect(diaEmDias(0, new Date(instante)), `${hora} com TZ=${fuso}`).toBe(dia);
        }
        // E o deslocamento em dias acompanha o mesmo calendário.
        expect(diaEmDias(1, new Date("2026-09-07T02:00:00Z")), fuso).toBe("2026-09-07");
        expect(diaEmDias(-1, new Date("2026-09-07T02:00:00Z")), fuso).toBe("2026-09-05");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
