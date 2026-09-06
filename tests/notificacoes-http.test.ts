import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { NotificacoesResponse, TipoNotificacao } from "@/types/feedback";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

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

let cookiePersonal = "";
let cookieAna = "";
let cookieBruno = "";

let treino = { id: "" };
let agendamentoDaAna = { id: "" };

/** Tipos das notificações do usuário, da mais recente para a mais antiga. */
async function tiposDe(cookie: string): Promise<TipoNotificacao[]> {
  const res = await get("/api/notificacoes", cookie);
  const data = (await res.json()) as NotificacoesResponse;
  return data.notificacoes.map((item) => item.tipo);
}

async function naoLidasDe(cookie: string): Promise<number> {
  const res = await get("/api/notificacoes", cookie);
  return ((await res.json()) as NotificacoesResponse).naoLidas;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });

  // Expediente todos os dias, para o agendamento do aluno não depender do dia.
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
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Notificações do aluno", () => {
  it("avisa quando o Personal cria um treino", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: ana.alunoProfile.id, nome: "Treino A · Superior" }),
      })
    );
    treino = await res.json();
    expect(res.status).toBe(201);

    const notificacoes = (await (
      await get("/api/notificacoes", cookieAna)
    ).json()) as NotificacoesResponse;

    expect(notificacoes.naoLidas).toBe(1);
    expect(notificacoes.notificacoes[0].tipo).toBe("NOVO_TREINO");
    expect(notificacoes.notificacoes[0].mensagem).toContain("Treino A · Superior");
    expect(notificacoes.notificacoes[0].link).toBe(`/aluno/treinos/${treino.id}`);

    // O aviso é só de quem recebeu o treino.
    expect(await naoLidasDe(cookieBruno)).toBe(0);
  });

  it("avisa quando o treino é alterado", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/treinos/${treino.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ nome: "Treino A · Superior (revisado)" }),
      })
    );
    expect(res.status).toBe(200);

    expect((await tiposDe(cookieAna))[0]).toBe("TREINO_ALTERADO");
  });

  it("avisa quando uma avaliação é cadastrada", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/avaliacoes`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: ana.alunoProfile.id, peso: 62.4 }),
      })
    );
    expect(res.status).toBe(201);

    const tipos = await tiposDe(cookieAna);
    expect(tipos[0]).toBe("NOVA_AVALIACAO");
  });

  it("avisa quando o Personal escreve um feedback", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/feedbacks`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          texto: "Parabéns pela evolução neste mês.",
        }),
      })
    );
    expect(res.status).toBe(201);

    expect((await tiposDe(cookieAna))[0]).toBe("NOVO_FEEDBACK");
  });

  it("avisa quando o Personal marca, confirma, remarca e cancela um horário", async () => {
    const criado = await fetch(
      `${BASE_URL}/api/personal/agendamentos`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          data: emDias(3),
          horaInicio: "07:00",
          horaFim: "08:00",
        }),
      })
    );
    agendamentoDaAna = await criado.json();
    expect(criado.status).toBe(201);
    // Nasce confirmado: o aluno recebe a confirmação.
    expect((await tiposDe(cookieAna))[0]).toBe("AGENDAMENTO_CONFIRMADO");

    const remarcado = await fetch(
      `${BASE_URL}/api/personal/agendamentos/${agendamentoDaAna.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ data: emDias(3), horaInicio: "09:00", horaFim: "10:00" }),
      })
    );
    expect(remarcado.status).toBe(200);
    expect((await tiposDe(cookieAna))[0]).toBe("AGENDAMENTO_REAGENDADO");

    const cancelado = await fetch(
      `${BASE_URL}/api/personal/agendamentos/${agendamentoDaAna.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );
    expect(cancelado.status).toBe(200);

    const notificacoes = (await (
      await get("/api/notificacoes", cookieAna)
    ).json()) as NotificacoesResponse;
    expect(notificacoes.notificacoes[0].tipo).toBe("AGENDAMENTO_CANCELADO");
    expect(notificacoes.notificacoes[0].mensagem).toContain("Carlos Personal");
  });
});

describe("Notificações do Personal", () => {
  it("avisa quando o aluno marca, remarca e cancela sozinho", async () => {
    // O Personal ainda não recebeu nada até aqui.
    expect(await naoLidasDe(cookiePersonal)).toBe(0);

    const marcado = await fetch(
      `${BASE_URL}/api/aluno/agendamentos`,
      comCookie(cookieAna, {
        method: "POST",
        body: JSON.stringify({ data: emDias(4), horaInicio: "07:00", horaFim: "08:00" }),
      })
    );
    const doAluno = await marcado.json();
    expect(marcado.status).toBe(201);

    const aposMarcar = (await (
      await get("/api/notificacoes", cookiePersonal)
    ).json()) as NotificacoesResponse;
    expect(aposMarcar.notificacoes[0].tipo).toBe("NOVO_AGENDAMENTO");
    expect(aposMarcar.notificacoes[0].mensagem).toContain("Ana Aluna");
    expect(aposMarcar.notificacoes[0].link).toBe("/personal/agenda");

    const remarcado = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${doAluno.id}`,
      comCookie(cookieAna, {
        method: "PATCH",
        body: JSON.stringify({ data: emDias(4), horaInicio: "10:00", horaFim: "11:00" }),
      })
    );
    expect(remarcado.status).toBe(200);
    expect((await tiposDe(cookiePersonal))[0]).toBe("AGENDAMENTO_REAGENDADO");

    const cancelado = await fetch(
      `${BASE_URL}/api/aluno/agendamentos/${doAluno.id}`,
      comCookie(cookieAna, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) })
    );
    expect(cancelado.status).toBe(200);

    const aposCancelar = (await (
      await get("/api/notificacoes", cookiePersonal)
    ).json()) as NotificacoesResponse;
    expect(aposCancelar.notificacoes[0].tipo).toBe("AGENDAMENTO_CANCELADO");
    expect(aposCancelar.notificacoes[0].mensagem).toContain("Ana Aluna");
  });
});

describe("Contador, marcar como lida e isolamento", () => {
  it("conta as não lidas do próprio usuário", async () => {
    const doPersonal = await naoLidasDe(cookiePersonal);
    const daAna = await naoLidasDe(cookieAna);

    expect(doPersonal).toBe(3);
    expect(daAna).toBeGreaterThanOrEqual(6);
    expect(await naoLidasDe(cookieBruno)).toBe(0);
  });

  it("marca uma como lida", async () => {
    const antes = (await (
      await get("/api/notificacoes", cookiePersonal)
    ).json()) as NotificacoesResponse;

    const res = await fetch(
      `${BASE_URL}/api/notificacoes/${antes.notificacoes[0].id}`,
      comCookie(cookiePersonal, { method: "PATCH" })
    );
    expect(res.status).toBe(200);

    const depois = (await (
      await get("/api/notificacoes", cookiePersonal)
    ).json()) as NotificacoesResponse;
    expect(depois.naoLidas).toBe(antes.naoLidas - 1);
    expect(depois.notificacoes[0].lida).toBe(true);
  });

  it("marca todas como lidas", async () => {
    const res = await fetch(
      `${BASE_URL}/api/notificacoes/lidas`,
      comCookie(cookiePersonal, { method: "POST" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.marcadas).toBe(2);
    expect(await naoLidasDe(cookiePersonal)).toBe(0);

    // As do aluno seguem intactas: cada um marca as suas.
    expect(await naoLidasDe(cookieAna)).toBeGreaterThan(0);
  });

  it("não deixa marcar notificação de outro usuário", async () => {
    const daAna = (await (
      await get("/api/notificacoes", cookieAna)
    ).json()) as NotificacoesResponse;

    const res = await fetch(
      `${BASE_URL}/api/notificacoes/${daAna.notificacoes[0].id}`,
      comCookie(cookiePersonal, { method: "PATCH" })
    );
    expect(res.status).toBe(404);
  });

  it("exige autenticação", async () => {
    expect((await get("/api/notificacoes")).status).toBe(401);

    const semSessao = await fetch(`${BASE_URL}/api/notificacoes/lidas`, { method: "POST" });
    expect(semSessao.status).toBe(401);
  });
});

describe("Arquitetura de canais", () => {
  it("hoje entrega só pelo canal interno, com os outros declarados", async () => {
    const { CANAIS, canaisHabilitados } = await import("@/lib/notificacoes/canais");

    expect(CANAIS.map((canal) => canal.nome)).toEqual([
      "INTERNO",
      "EMAIL",
      "WHATSAPP",
      "PUSH",
    ]);
    // Só o interno está ligado - e-mail, WhatsApp e push ficam para depois.
    expect(canaisHabilitados().map((canal) => canal.nome)).toEqual(["INTERNO"]);
  });

  it("uma falha de entrega não derruba a ação que disparou o evento", async () => {
    const { notificar } = await import("@/lib/notificacoes/enviar");

    // Aluno inexistente: o despachante engole o problema em vez de estourar.
    await expect(
      notificar({
        tipo: "NOVO_TREINO",
        alunoId: "00000000-0000-0000-0000-000000000000",
        treino: { id: "x", nome: "Treino fantasma" },
      })
    ).resolves.toBeUndefined();
  });
});
