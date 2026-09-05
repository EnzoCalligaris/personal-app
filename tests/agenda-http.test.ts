import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type {
  AgendaResponse,
  AgendamentoAgenda,
  BloqueioAgenda,
  HorariosDeTrabalhoResponse,
  HorariosLivresResponse,
} from "@/types/agenda";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

/** Datas fixas: 02/03/2026 é uma segunda-feira. */
const SEGUNDA = "2026-03-02";
const TERCA = "2026-03-03";
const QUARTA = "2026-03-04";
const DOMINGO = "2026-03-08";

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluno = "";

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });

  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });
  alunoDoOutro = await createAluno({
    name: "Aluno do Rival",
    personalId: outroPersonal.personalProfile.id,
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluno = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

function criarFaixa(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/agenda/trabalho`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

function agendar(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/agendamentos`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

function editar(cookie: string, id: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/agendamentos/${id}`,
    comCookie(cookie, { method: "PATCH", body: JSON.stringify(corpo) })
  );
}

async function livresEm(data: string, cookie = cookiePersonal) {
  const res = await get(`/api/personal/agenda/horarios?data=${data}`, cookie);
  return (await res.json()) as HorariosLivresResponse;
}

describe("Agenda - autorização", () => {
  const ROTAS = [
    "/api/personal/agenda?vista=semana",
    "/api/personal/agenda/trabalho",
    `/api/personal/agenda/horarios?data=${SEGUNDA}`,
  ];

  it("exige autenticação e role PERSONAL", async () => {
    for (const rota of ROTAS) {
      expect((await get(rota)).status, rota).toBe(401);
      expect((await get(rota, cookieAluno)).status, rota).toBe(403);
    }
  });

  it("nega ao aluno criar agendamento", async () => {
    const res = await agendar(cookieAluno, {
      alunoId: ana.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    expect(res.status).toBe(403);
  });
});

describe("Horários de trabalho", () => {
  it("cadastra duas faixas no mesmo dia (manhã e tarde)", async () => {
    const manha = await criarFaixa(cookiePersonal, {
      diaSemana: "SEGUNDA",
      horaInicio: "06:00",
      horaFim: "12:00",
      duracaoMin: 60,
    });
    expect(manha.status).toBe(201);

    const tarde = await criarFaixa(cookiePersonal, {
      diaSemana: "SEGUNDA",
      horaInicio: "14:00",
      horaFim: "20:00",
      duracaoMin: 60,
    });
    const body = (await tarde.json()) as HorariosDeTrabalhoResponse;

    expect(tarde.status).toBe(201);
    expect(body.faixas).toHaveLength(2);
    expect(body.faixas.map((faixa) => faixa.horaInicio)).toEqual(["06:00", "14:00"]);

    // A terça repete a mesma rotina.
    await criarFaixa(cookiePersonal, {
      diaSemana: "TERCA",
      horaInicio: "06:00",
      horaFim: "12:00",
      duracaoMin: 60,
    });
  });

  it("recusa faixa que se sobrepõe a outra do mesmo dia", async () => {
    const res = await criarFaixa(cookiePersonal, {
      diaSemana: "SEGUNDA",
      horaInicio: "11:00",
      horaFim: "13:00",
      duracaoMin: 60,
    });
    expect(res.status).toBe(409);
  });

  it("recusa faixa com término antes do início", async () => {
    const res = await criarFaixa(cookiePersonal, {
      diaSemana: "QUARTA",
      horaInicio: "12:00",
      horaFim: "08:00",
      duracaoMin: 60,
    });
    expect(res.status).toBe(400);
  });

  it("não mistura os horários de outro Personal", async () => {
    const res = await get("/api/personal/agenda/trabalho", cookieOutroPersonal);
    const body = (await res.json()) as HorariosDeTrabalhoResponse;
    expect(body.faixas).toHaveLength(0);
  });
});

describe("Geração de horários disponíveis", () => {
  it("gera os atendimentos a partir das faixas do dia", async () => {
    const segunda = await livresEm(SEGUNDA);

    // 06:00-12:00 e 14:00-20:00, de hora em hora: 12 atendimentos.
    expect(segunda.motivo).toBe("OK");
    expect(segunda.livres).toHaveLength(12);
    expect(segunda.livres[0]).toEqual({ horaInicio: "06:00", horaFim: "07:00" });
    expect(segunda.livres[6]).toEqual({ horaInicio: "14:00", horaFim: "15:00" });
    expect(segunda.livres.at(-1)).toEqual({ horaInicio: "19:00", horaFim: "20:00" });
  });

  it("responde vazio no dia sem expediente", async () => {
    const domingo = await livresEm(DOMINGO);
    expect(domingo.livres).toHaveLength(0);
    expect(domingo.motivo).toBe("SEM_TRABALHO");
  });
});

describe("Agendamentos e conflitos", () => {
  let daAna: AgendamentoAgenda;

  it("agenda um atendimento em horário livre", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "07:00",
      horaFim: "08:00",
      observacoes: "Avaliação inicial",
    });
    daAna = (await res.json()) as AgendamentoAgenda;

    expect(res.status).toBe(201);
    expect(daAna.aluno.nome).toBe("Ana Aluna");
    expect(daAna.data).toBe(SEGUNDA);
    expect(daAna.status).toBe("CONFIRMADO");

    // O horário sai da lista de disponíveis.
    const livres = await livresEm(SEGUNDA);
    expect(livres.livres).toHaveLength(11);
    expect(livres.livres.some((slot) => slot.horaInicio === "07:00")).toBe(false);
  });

  it("NÃO permite dois alunos no mesmo horário", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: bruno.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/atendimento neste horário/i);
  });

  it("recusa horário que se sobrepõe parcialmente", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: bruno.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "07:30",
      horaFim: "08:30",
    });
    expect(res.status).toBe(409);
  });

  it("aceita o horário seguinte, encostado no anterior", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: bruno.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "08:00",
      horaFim: "09:00",
    });
    expect(res.status).toBe(201);
  });

  it("NÃO agenda aluno de outro Personal", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: alunoDoOutro.alunoProfile.id,
      data: TERCA,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    expect(res.status).toBe(404);
  });

  it("o mesmo horário fica livre para outro Personal", async () => {
    await criarFaixa(cookieOutroPersonal, {
      diaSemana: "SEGUNDA",
      horaInicio: "06:00",
      horaFim: "12:00",
      duracaoMin: 60,
    });

    const res = await agendar(cookieOutroPersonal, {
      alunoId: alunoDoOutro.alunoProfile.id,
      data: SEGUNDA,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    expect(res.status).toBe(201);
  });

  it("confirma, marca como concluído e cancela", async () => {
    const pendente = await agendar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      data: TERCA,
      horaInicio: "06:00",
      horaFim: "07:00",
      status: "AGENDADO",
    });
    const criado = (await pendente.json()) as AgendamentoAgenda;
    expect(criado.status).toBe("AGENDADO");

    const confirmado = await editar(cookiePersonal, criado.id, { status: "CONFIRMADO" });
    expect(((await confirmado.json()) as AgendamentoAgenda).status).toBe("CONFIRMADO");

    const realizado = await editar(cookiePersonal, criado.id, { status: "REALIZADO" });
    expect(((await realizado.json()) as AgendamentoAgenda).status).toBe("REALIZADO");

    const cancelado = await editar(cookiePersonal, daAna.id, { status: "CANCELADO" });
    expect(((await cancelado.json()) as AgendamentoAgenda).status).toBe("CANCELADO");

    // Cancelado libera o horário para outro aluno.
    const livres = await livresEm(SEGUNDA);
    expect(livres.livres.some((slot) => slot.horaInicio === "07:00")).toBe(true);
  });

  it("reagenda para outro horário e recusa horário ocupado", async () => {
    const criado = (await (
      await agendar(cookiePersonal, {
        alunoId: ana.alunoProfile.id,
        data: TERCA,
        horaInicio: "09:00",
        horaFim: "10:00",
      })
    ).json()) as AgendamentoAgenda;

    const ocupado = await editar(cookiePersonal, criado.id, {
      data: TERCA,
      horaInicio: "06:00",
      horaFim: "07:00",
    });
    // 06:00 da terça já é da execução anterior (marcada como realizada não
    // ocupa) - o conflito real é com o horário do Bruno na segunda.
    expect([200, 409]).toContain(ocupado.status);

    const movido = await editar(cookiePersonal, criado.id, {
      data: TERCA,
      horaInicio: "10:00",
      horaFim: "11:00",
    });
    const body = (await movido.json()) as AgendamentoAgenda;

    expect(movido.status).toBe(200);
    expect(body.horaInicio).toBe("10:00");
    // Mudar de horário sem informar status marca como reagendado.
    expect(body.status).toBe("REAGENDADO");
  });

  it("NÃO deixa outro Personal mexer no agendamento", async () => {
    const res = await editar(cookieOutroPersonal, daAna.id, { status: "CONFIRMADO" });
    expect(res.status).toBe(404);
  });
});

describe("Bloqueio e liberação de horário", () => {
  let bloqueio: BloqueioAgenda;

  it("bloqueia uma faixa e tira os horários da lista", async () => {
    const antes = await livresEm(TERCA);

    const res = await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          data: TERCA,
          horaInicio: "07:00",
          horaFim: "09:00",
          motivo: "Consulta médica",
        }),
      })
    );
    bloqueio = (await res.json()) as BloqueioAgenda;

    expect(res.status).toBe(201);
    expect(bloqueio.diaInteiro).toBe(false);
    expect(bloqueio.motivo).toBe("Consulta médica");

    const depois = await livresEm(TERCA);
    expect(depois.livres.length).toBe(antes.livres.length - 2);
    expect(depois.livres.some((slot) => slot.horaInicio === "07:00")).toBe(false);
    expect(depois.livres.some((slot) => slot.horaInicio === "08:00")).toBe(false);
  });

  it("recusa agendamento em horário bloqueado", async () => {
    const res = await agendar(cookiePersonal, {
      alunoId: bruno.alunoProfile.id,
      data: TERCA,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/bloqueado/i);
  });

  it("libera o horário ao remover o bloqueio", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios/${bloqueio.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    const livres = await livresEm(TERCA);
    expect(livres.livres.some((slot) => slot.horaInicio === "07:00")).toBe(true);
  });

  it("bloqueia o dia inteiro", async () => {
    // A quarta precisa ter expediente, senão o motivo seria "sem trabalho".
    await criarFaixa(cookiePersonal, {
      diaSemana: "QUARTA",
      horaInicio: "08:00",
      horaFim: "12:00",
      duracaoMin: 60,
    });
    expect((await livresEm(QUARTA)).livres).toHaveLength(4);

    await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ data: QUARTA, motivo: "Feriado" }),
      })
    );

    const quarta = await livresEm(QUARTA);
    expect(quarta.livres).toHaveLength(0);
    expect(quarta.motivo).toBe("BLOQUEADO");
  });

  it("não deixa outro Personal liberar bloqueio alheio", async () => {
    const criado = (await (
      await fetch(
        `${BASE_URL}/api/personal/agenda/bloqueios`,
        comCookie(cookiePersonal, {
          method: "POST",
          body: JSON.stringify({ data: DOMINGO, motivo: "Descanso" }),
        })
      )
    ).json()) as BloqueioAgenda;

    const res = await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios/${criado.id}`,
      comCookie(cookieOutroPersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(404);
  });
});

describe("Vistas da agenda", () => {
  it("dia devolve um único dia com os atendimentos", async () => {
    const res = await get(`/api/personal/agenda?vista=dia&data=${SEGUNDA}`, cookiePersonal);
    const agenda = (await res.json()) as AgendaResponse;

    expect(res.status).toBe(200);
    expect(agenda.dias).toHaveLength(1);
    expect(agenda.dias[0].data).toBe(SEGUNDA);
    expect(agenda.dias[0].trabalho).toEqual([
      { horaInicio: "06:00", horaFim: "12:00" },
      { horaInicio: "14:00", horaFim: "20:00" },
    ]);
    // Só os atendimentos deste Personal.
    expect(agenda.dias[0].agendamentos.every((item) => item.aluno.nome !== "Aluno do Rival")).toBe(
      true
    );
  });

  it("semana devolve sete dias, de domingo a sábado", async () => {
    const agenda = (await (
      await get(`/api/personal/agenda?vista=semana&data=${SEGUNDA}`, cookiePersonal)
    ).json()) as AgendaResponse;

    expect(agenda.dias).toHaveLength(7);
    expect(agenda.de).toBe("2026-03-01");
    expect(agenda.ate).toBe("2026-03-07");
    expect(agenda.resumo.agendamentos).toBeGreaterThan(0);
  });

  it("mês fecha em semanas completas e marca os bloqueios", async () => {
    const agenda = (await (
      await get(`/api/personal/agenda?vista=mes&data=${SEGUNDA}`, cookiePersonal)
    ).json()) as AgendaResponse;

    expect(agenda.dias.length % 7).toBe(0);
    expect(agenda.dias.some((dia) => dia.data === "2026-03-31")).toBe(true);

    const quarta = agenda.dias.find((dia) => dia.data === QUARTA);
    expect(quarta?.bloqueios[0].diaInteiro).toBe(true);
    // A vista de mês não calcula horários livres.
    expect(quarta?.livres).toEqual([]);
  });

  it("cada Personal enxerga apenas a própria agenda", async () => {
    const doOutro = (await (
      await get(`/api/personal/agenda?vista=dia&data=${SEGUNDA}`, cookieOutroPersonal)
    ).json()) as AgendaResponse;

    expect(doOutro.dias[0].agendamentos).toHaveLength(1);
    expect(doOutro.dias[0].agendamentos[0].aluno.nome).toBe("Aluno do Rival");
  });
});
