import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createPersonal, createTreino } from "./factories";
import { dataDeCalendarioDe } from "@/lib/fuso";
import { BASE_URL, get, login, SENHA } from "./http";

/**
 * O servidor destes testes roda em UTC (ver `tests/global-setup.ts`), que é o
 * fuso de qualquer contêiner, enquanto a máquina que roda a suíte costuma
 * estar em UTC-3. É a diferença que fazia o dia escorregar.
 *
 * Aqui a verificação é ponta a ponta: o dia que o Personal marcou é o dia que
 * o aluno vê, e a hora é a mesma para os dois.
 */

const DIAS_SEMANA = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const;

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieAna = "";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

/** Data de calendário daqui a N dias, no relógio de quem roda o teste. */
function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Fuso" });
  ana = await createAluno({ name: "Ana Fuso", personalId: personal.personalProfile.id });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;

  // Expediente longo todos os dias, para nenhum horário do teste cair fora.
  await prisma.disponibilidade.createMany({
    data: DIAS_SEMANA.map((diaSemana) => ({
      personalId: personal.personalProfile.id,
      diaSemana,
      horaInicio: "06:00",
      horaFim: "23:00",
      duracaoMin: 60,
    })),
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("O dia marcado é o dia guardado", () => {
  it("um atendimento não muda de dia entre marcar, gravar e ler", async () => {
    const data = emDias(4);

    const criado = await fetch(
      `${BASE_URL}/api/personal/agendamentos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          data,
          horaInicio: "07:00",
          horaFim: "08:00",
        }),
      })
    );
    const agendamento = await criado.json();

    expect(criado.status).toBe(201);
    expect(agendamento.data, "resposta da criação").toBe(data);

    // No banco, sem passar pela aplicação: a coluna guarda o dia, sem hora.
    const linha = await prisma.agendamento.findUniqueOrThrow({
      where: { id: agendamento.id },
      select: { data: true, horaInicio: true },
    });
    expect(linha.data.toISOString().slice(0, 10), "coluna do banco").toBe(data);
    expect(linha.horaInicio).toBe("07:00");
  });

  it("horários nas bordas do dia não vazam para o dia vizinho", async () => {
    const data = emDias(5);

    for (const [horaInicio, horaFim] of [
      ["06:00", "07:00"],
      ["22:00", "23:00"],
    ]) {
      const res = await fetch(
        `${BASE_URL}/api/personal/agendamentos`,
        comCookie(cookiePersonal, {
          method: "POST",
          body: JSON.stringify({ alunoId: ana.alunoProfile.id, data, horaInicio, horaFim }),
        })
      );
      const corpo = await res.json();

      expect(res.status, `${horaInicio}-${horaFim}`).toBe(201);
      expect(corpo.data, `${horaInicio} deveria continuar no dia ${data}`).toBe(data);
    }

    // Os dois aparecem no mesmo dia da agenda do Personal.
    const agenda = await (
      await get(`/api/personal/agenda?vista=dia&data=${data}`, cookiePersonal)
    ).json();
    const dia = agenda.dias.find((item: { data: string }) => item.data === data);

    expect(dia, `o dia ${data} veio na resposta`).toBeTruthy();
    expect(dia.agendamentos.map((a: { horaInicio: string }) => a.horaInicio).sort()).toEqual([
      "06:00",
      "22:00",
    ]);
  });
});

describe("Personal e aluno enxergam o mesmo horário", () => {
  it("a mesma data e a mesma hora nas duas áreas", async () => {
    const data = emDias(6);

    const criado = await (
      await fetch(
        `${BASE_URL}/api/personal/agendamentos`,
        comCookie(cookiePersonal, {
          method: "POST",
          body: JSON.stringify({
            alunoId: ana.alunoProfile.id,
            data,
            horaInicio: "19:00",
            horaFim: "20:00",
            status: "CONFIRMADO",
          }),
        })
      )
    ).json();

    const doAluno = await (await get("/api/aluno/agenda", cookieAna)).json();
    const mesmo = doAluno.proximos.find((item: { id: string }) => item.id === criado.id);

    expect(mesmo, "o aluno enxerga o atendimento").toBeTruthy();
    expect(mesmo.data).toBe(criado.data);
    expect(mesmo.data).toBe(data);
    expect(mesmo.horaInicio).toBe("19:00");
    expect(mesmo.horaFim).toBe("20:00");
  });

  it("o horário oferecido ao aluno é o mesmo que o Personal vê como livre", async () => {
    const data = emDias(7);

    // Libera a cota de atendimentos ativos: o limite por aluno é uma regra do
    // Personal, e os casos acima já a ocuparam.
    await prisma.agendamento.updateMany({
      where: { alunoId: ana.alunoProfile.id },
      data: { status: "CANCELADO" },
    });

    const doPersonal = await (
      await get(`/api/personal/agenda/horarios?data=${data}`, cookiePersonal)
    ).json();
    const doAluno = await (
      await get(`/api/aluno/agenda/horarios?data=${data}`, cookieAna)
    ).json();

    const horasPersonal = doPersonal.livres.map((s: { horaInicio: string }) => s.horaInicio);
    const horasAluno = doAluno.livres.map((s: { horaInicio: string }) => s.horaInicio);

    expect(horasPersonal.length).toBeGreaterThan(0);
    expect(horasAluno).toEqual(horasPersonal);
  });
});

describe("Treinos e histórico seguem o calendário brasileiro", () => {
  it("um treino executado à noite conta no dia em que foi feito", async () => {
    const treino = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
      nome: "Treino da noite",
    });

    // 22:30 no Brasil - em UTC já é o dia seguinte.
    const hoje = emDias(0);
    const noite = new Date(`${hoje}T22:30:00-03:00`);
    await prisma.historicoTreino.create({
      data: {
        treinoId: treino.id,
        treinoNome: treino.nome,
        alunoId: ana.alunoProfile.id,
        dataExecucao: noite,
        concluido: true,
      },
    });

    const historico = await (await get("/api/aluno/historico", cookieAna)).json();
    const registro = historico.execucoes.find(
      (item: { treino: { nome: string } }) => item.treino.nome === "Treino da noite"
    );

    expect(registro, "a execução aparece no histórico").toBeTruthy();
    // A execução é um INSTANTE - cortar o ISO em 10 daria a data em UTC, que
    // é o dia seguinte. O dia é o que esse instante representa no Brasil.
    expect(dataDeCalendarioDe(new Date(registro.data)), "o dia da execução").toBe(hoje);
  });
});
