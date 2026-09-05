import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { diaSemanaDe } from "@/lib/date-utils";
import type { DashboardData } from "@/types/dashboard";
import { resetDb } from "./db";
import {
  createAgendamento,
  createAluno,
  createAvaliacao,
  createHistorico,
  createPersonal,
  createTreino,
} from "./factories";
import { get, login, SENHA } from "./http";

function emDias(dias: number, hora = 12) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/**
 * Um instante de hoje que já passou - independente da hora em que a suíte
 * roda. Usar uma hora fixa (ex.: 08:00) tornaria o teste dependente do
 * relógio: de madrugada, esse horário ainda estaria no futuro e entraria na
 * contagem de "próximos agendamentos".
 */
function hojeJaPassado() {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  const duasHorasAtras = agora.getTime() - 2 * 60 * 60 * 1000;
  const instante = Math.max(inicioDoDia.getTime(), duasHorasAtras);
  return new Date(instante < agora.getTime() ? instante : agora.getTime() - 1);
}

const hoje = diaSemanaDe(new Date());
const amanha = diaSemanaDe(emDias(1));

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
    diaSemana: hoje,
  });
  await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino B · Inferior",
    diaSemana: amanha,
  });
  // Treino inativo não deve entrar na contagem de "treinos de hoje".
  await createTreino(personal.personalProfile.id, bruno.alunoProfile.id, {
    nome: "Treino arquivado",
    diaSemana: hoje,
    ativo: false,
  });

  await createHistorico(treinoDeHoje.id, ana.alunoProfile.id, { dataExecucao: emDias(-2) });

  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: hojeJaPassado(),
    horaInicio: "08:00",
    horaFim: "09:00",
  });
  await createAgendamento(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: emDias(2, 18),
    horaInicio: "18:00",
    horaFim: "19:00",
  });
  await createAgendamento(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: emDias(3, 18),
    status: "CANCELADO",
  });

  await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: emDias(-3),
    peso: 62.4,
    percentualGordura: 24.1,
  });
  await createAvaliacao(personal.personalProfile.id, bruno.alunoProfile.id, {
    data: emDias(-45),
  });

  // Dados do outro Personal - nada disso pode aparecer no dashboard.
  await createTreino(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    diaSemana: hoje,
  });
  await createAgendamento(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    data: emDias(0, 10),
  });
  await createAvaliacao(outroPersonal.personalProfile.id, alunoDoOutro.alunoProfile.id, {
    data: emDias(-1),
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
    expect(item.status).toBe("AGENDADO");
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
