import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/date-utils";
import { dataDeCalendarioDe, horaDeParede } from "@/lib/fuso";
import type { RegrasAgendamento } from "@/types/agenda";
import type {
  DiasParaAgendarResponse,
  HorariosParaAgendarResponse,
  MeuAgendamento,
  MinhaAgendaResponse,
} from "@/types/aluno-area";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

/** Data ISO de hoje + N dias, no fuso local (é assim que a agenda raciocina). */
function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const DIAS_SEMANA = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let semPersonal: Awaited<ReturnType<typeof createAluno>>;

let cookieAna = "";
let cookieBruno = "";
let cookieSemPersonal = "";
let cookiePersonal = "";

/** Daqui a 3 dias: longe o bastante para passar em qualquer antecedência. */
const DAQUI_TRES_DIAS = emDias(3);

async function regras(mudanca: Partial<RegrasAgendamento>) {
  const res = await fetch(
    `${BASE_URL}/api/personal/agenda/regras`,
    comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify(mudanca) })
  );
  return (await res.json()) as { regras: RegrasAgendamento };
}

function agendar(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/aluno/agendamentos`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

async function horariosEm(data: string, cookie = cookieAna) {
  const res = await get(`/api/aluno/agenda/horarios?data=${data}`, cookie);
  return (await res.json()) as HorariosParaAgendarResponse;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });
  semPersonal = await createAluno({ name: "Sem Personal", personalId: null });

  // Expediente todos os dias, para o teste não depender do dia da semana.
  await prisma.disponibilidade.createMany({
    data: DIAS_SEMANA.map((diaSemana) => ({
      personalId: personal.personalProfile.id,
      diaSemana,
      horaInicio: "06:00",
      horaFim: "12:00",
      duracaoMin: 60,
    })),
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
  cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
  cookieSemPersonal = (await login(semPersonal.user.email, SENHA)).cookie;

  // Regras conhecidas: 12h de antecedência, janela de 30 dias, 3 marcações.
  await regras({
    permiteAgendamento: true,
    antecedenciaMinHoras: 12,
    janelaDias: 30,
    cancelamentoMinHoras: 12,
    maxAtivosPorAluno: 3,
    confirmacaoAutomatica: false,
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Agendamento pelo aluno - autorização", () => {
  it("exige sessão de aluno", async () => {
    expect((await get("/api/aluno/agenda/dias")).status).toBe(401);
    expect((await get("/api/aluno/agenda/dias", cookiePersonal)).status).toBe(403);

    const semLogin = await fetch(`${BASE_URL}/api/aluno/agendamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(semLogin.status).toBe(401);
  });

  it("avisa quando o aluno não tem Personal vinculado", async () => {
    const res = await get("/api/aluno/agenda/dias", cookieSemPersonal);
    expect(res.status).toBe(409);
  });
});

describe("Horários oferecidos ao aluno", () => {
  it("lista os horários livres da data", async () => {
    const horarios = await horariosEm(DAQUI_TRES_DIAS);

    expect(horarios.motivo).toBe("OK");
    // 06:00-12:00 de hora em hora.
    expect(horarios.livres).toHaveLength(6);
    expect(horarios.livres[0]).toEqual({ horaInicio: "06:00", horaFim: "07:00" });
  });

  it("NÃO oferece horários no passado", async () => {
    const ontem = await horariosEm(emDias(-1));
    expect(ontem.livres).toHaveLength(0);
    expect(ontem.motivo).toBe("PASSADO");
  });

  it("respeita a antecedência mínima", async () => {
    // Com 48h de antecedência, amanhã não pode mais ser marcado.
    await regras({ antecedenciaMinHoras: 48 });

    const amanha = await horariosEm(emDias(1));
    expect(amanha.livres).toHaveLength(0);
    expect(amanha.motivo).toBe("ANTECEDENCIA");

    // E daqui a 3 dias continua liberado.
    expect((await horariosEm(DAQUI_TRES_DIAS)).livres.length).toBeGreaterThan(0);

    await regras({ antecedenciaMinHoras: 12 });
  });

  it("respeita a janela de agendamento", async () => {
    await regras({ janelaDias: 2 });

    const longe = await horariosEm(emDias(10));
    expect(longe.livres).toHaveLength(0);
    expect(longe.motivo).toBe("FORA_DA_JANELA");

    await regras({ janelaDias: 30 });
  });

  it("some com o horário bloqueado pelo Personal", async () => {
    const antes = await horariosEm(DAQUI_TRES_DIAS);

    const bloqueio = await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          data: DAQUI_TRES_DIAS,
          horaInicio: "06:00",
          horaFim: "07:00",
          motivo: "Reunião",
        }),
      })
    );
    const criado = await bloqueio.json();

    const depois = await horariosEm(DAQUI_TRES_DIAS);
    expect(depois.livres.length).toBe(antes.livres.length - 1);
    expect(depois.livres.some((slot) => slot.horaInicio === "06:00")).toBe(false);

    // Tentar marcar no bloqueado é recusado mesmo passando por cima da tela.
    const tentativa = await agendar(cookieAna, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "06:00",
      horaFim: "07:00",
    });
    expect(tentativa.status).toBe(409);
    expect((await tentativa.json()).error).toMatch(/bloqueado/i);

    await fetch(
      `${BASE_URL}/api/personal/agenda/bloqueios/${criado.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
  });

  it("traz a janela de dias com a contagem de livres", async () => {
    const res = await get("/api/aluno/agenda/dias", cookieAna);
    const janela = (await res.json()) as DiasParaAgendarResponse;

    expect(res.status).toBe(200);
    expect(janela.personal?.nome).toBe("Carlos Personal");
    expect(janela.regras.antecedenciaMinHoras).toBe(12);
    expect(janela.dias.length).toBeGreaterThan(0);
    // Hoje já está fora pela antecedência; daqui a 3 dias tem vaga.
    expect(janela.dias.find((dia) => dia.data === DAQUI_TRES_DIAS)?.livres).toBeGreaterThan(0);
  });
});

describe("Marcar horário", () => {
  let daAna: MeuAgendamento;

  it("marca e devolve o atendimento aguardando confirmação", async () => {
    const res = await agendar(cookieAna, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "07:00",
      horaFim: "08:00",
      observacoes: "Quero focar em pernas.",
    });
    daAna = (await res.json()) as MeuAgendamento;

    expect(res.status).toBe(201);
    expect(daAna.status).toBe("AGENDADO");
    expect(daAna.horaInicio).toBe("07:00");
    expect(daAna.podeDesmarcar).toBe(true);
    // O dia volta como dia de calendário, não como instante: quem recebia
    // "...T00:00:00.000Z" exibia a véspera na tela do aluno.
    expect(daAna.data).toBe(DAQUI_TRES_DIAS);

    // O horário sai da lista oferecida.
    const horarios = await horariosEm(DAQUI_TRES_DIAS);
    expect(horarios.livres.some((slot) => slot.horaInicio === "07:00")).toBe(false);
  });

  it("NÃO deixa dois alunos no mesmo horário", async () => {
    const res = await agendar(cookieBruno, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/preenchido/i);
  });

  it("NÃO deixa marcar no passado nem fora do expediente", async () => {
    const passado = await agendar(cookieAna, {
      data: emDias(-1),
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    expect(passado.status).toBe(409);

    const foraDoExpediente = await agendar(cookieAna, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "22:00",
      horaFim: "23:00",
    });
    expect(foraDoExpediente.status).toBe(409);
    expect((await foraDoExpediente.json()).error).toMatch(/não atende/i);
  });

  it("respeita a antecedência mínima também ao gravar", async () => {
    await regras({ antecedenciaMinHoras: 72 });

    const res = await agendar(cookieAna, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "09:00",
      horaFim: "10:00",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/antecedência/i);

    await regras({ antecedenciaMinHoras: 12 });
  });

  it("respeita o limite de atendimentos marcados", async () => {
    await regras({ maxAtivosPorAluno: 1 });

    const res = await agendar(cookieAna, {
      data: emDias(4),
      horaInicio: "07:00",
      horaFim: "08:00",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/limite/i);

    // A tela também explica o motivo em vez de listar horários.
    const horarios = await horariosEm(emDias(4));
    expect(horarios.motivo).toBe("LIMITE_ATINGIDO");

    await regras({ maxAtivosPorAluno: 3 });
  });

  it("não deixa marcar quando o Personal desliga o agendamento", async () => {
    await regras({ permiteAgendamento: false });

    const res = await agendar(cookieBruno, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "08:00",
      horaFim: "09:00",
    });
    expect(res.status).toBe(409);

    const horarios = await horariosEm(DAQUI_TRES_DIAS, cookieBruno);
    expect(horarios.motivo).toBe("AGENDAMENTO_DESATIVADO");

    await regras({ permiteAgendamento: true });
  });

  it("confirma na hora quando o Personal liga a confirmação automática", async () => {
    await regras({ confirmacaoAutomatica: true });

    const res = await agendar(cookieBruno, {
      data: DAQUI_TRES_DIAS,
      horaInicio: "08:00",
      horaFim: "09:00",
    });
    const criado = (await res.json()) as MeuAgendamento;

    expect(res.status).toBe(201);
    expect(criado.status).toBe("CONFIRMADO");

    await regras({ confirmacaoAutomatica: false });
  });
});

describe("Minha agenda: cancelar e reagendar", () => {
  it("mostra próximos, histórico e as regras", async () => {
    const res = await get("/api/aluno/agenda", cookieAna);
    const agenda = (await res.json()) as MinhaAgendaResponse;

    expect(res.status).toBe(200);
    expect(agenda.regras.cancelamentoMinHoras).toBe(12);
    expect(agenda.proximos).toHaveLength(1);
    expect(agenda.proximos[0].podeDesmarcar).toBe(true);
    expect(agenda.proximos[0].horaInicio).toBe("07:00");
    expect(agenda.proximos[0].data).toBe(DAQUI_TRES_DIAS);
  });

  it("reagenda para outro horário livre", async () => {
    const agenda = (await (await get("/api/aluno/agenda", cookieAna)).json()) as MinhaAgendaResponse;
    const atual = agenda.proximos[0];

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${atual.id}`,
      comCookie(cookieAna, {
        method: "PATCH",
        body: JSON.stringify({
          data: DAQUI_TRES_DIAS,
          horaInicio: "09:00",
          horaFim: "10:00",
        }),
      })
    );
    const body = (await res.json()) as MeuAgendamento;

    expect(res.status).toBe(200);
    expect(body.horaInicio).toBe("09:00");
    expect(body.status).toBe("REAGENDADO");

    // O horário antigo volta a ficar livre.
    const horarios = await horariosEm(DAQUI_TRES_DIAS);
    expect(horarios.livres.some((slot) => slot.horaInicio === "07:00")).toBe(true);
  });

  it("NÃO reagenda para horário de outro aluno", async () => {
    const agenda = (await (await get("/api/aluno/agenda", cookieAna)).json()) as MinhaAgendaResponse;

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${agenda.proximos[0].id}`,
      comCookie(cookieAna, {
        method: "PATCH",
        // 08:00 é do Bruno.
        body: JSON.stringify({
          data: DAQUI_TRES_DIAS,
          horaInicio: "08:00",
          horaFim: "09:00",
        }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("NÃO mexe no agendamento de outro aluno", async () => {
    const doBruno = (await (
      await get("/api/aluno/agenda", cookieBruno)
    ).json()) as MinhaAgendaResponse;

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${doBruno.proximos[0].id}`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );
    expect(res.status).toBe(404);

    const intacto = await prisma.agendamento.findUniqueOrThrow({
      where: { id: doBruno.proximos[0].id },
    });
    expect(intacto.status).toBe("CONFIRMADO");
  });

  it("recusa cancelamento fora do prazo", async () => {
    /**
     * Um atendimento daqui a duas horas, criado pelo Personal.
     *
     * O dia e a hora saem do *mesmo* instante, lidos no fuso da aplicação: se
     * agora forem 23h, o atendimento cai às 01h de amanhã - e é essa a data
     * gravada. Somar duas horas ao relógio local e reaproveitar o dia de hoje
     * produzia um horário no passado, e o teste passava ou falhava conforme a
     * hora em que a suíte rodasse.
     */
    const daquiADuasHoras = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const dia = dataDeCalendarioDe(daquiADuasHoras);
    const hora = horaDeParede(daquiADuasHoras);
    const umaHoraDepois = horaDeParede(new Date(daquiADuasHoras.getTime() + 60 * 60 * 1000));

    const criado = await prisma.agendamento.create({
      data: {
        personalId: personal.personalProfile.id,
        alunoId: ana.alunoProfile.id,
        data: dataUTC(dia),
        horaInicio: hora,
        // Perto da meia-noite o fim viraria a madrugada seguinte; encerra no dia.
        horaFim: umaHoraDepois > hora ? umaHoraDepois : "23:59",
        status: "CONFIRMADO",
      },
    });

    const agenda = (await (await get("/api/aluno/agenda", cookieAna)).json()) as MinhaAgendaResponse;
    const doDia = agenda.proximos.find((item) => item.id === criado.id);
    // Faltam menos de 12h: o aluno não pode desmarcar sozinho.
    expect(doDia?.podeDesmarcar).toBe(false);

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${criado.id}`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/antecedência/i);

  });

  it("cancela dentro do prazo e libera o horário", async () => {
    const agenda = (await (await get("/api/aluno/agenda", cookieAna)).json()) as MinhaAgendaResponse;
    const noPrazo = agenda.proximos.find((item) => item.podeDesmarcar)!;

    const res = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${noPrazo.id}`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );
    const body = (await res.json()) as MeuAgendamento;

    expect(res.status).toBe(200);
    expect(body.status).toBe("CANCELADO");

    const horarios = await horariosEm(DAQUI_TRES_DIAS);
    expect(horarios.livres.some((slot) => slot.horaInicio === noPrazo.horaInicio)).toBe(true);
  });
});
