import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { FeedbackItem, FeedbackListResponse, NotificacoesResponse } from "@/types/feedback";
import type { MeusFeedbacksResponse } from "@/types/aluno-area";
import { resetDb } from "./db";
import { createAluno, createAvaliacao, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAna = "";
let cookieBruno = "";

let avaliacaoDaAna = { id: "" };
let feedbackDaAna: FeedbackItem;

const TEXTO = "Parabéns pela evolução neste mês. Continue mantendo a consistência.";

function escrever(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/feedbacks`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

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

  avaliacaoDaAna = await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    peso: 62.4,
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
  cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Feedback - autorização", () => {
  it("exige autenticação e role PERSONAL para escrever", async () => {
    expect((await get("/api/personal/feedbacks")).status).toBe(401);
    expect((await get("/api/personal/feedbacks", cookieAna)).status).toBe(403);

    const comoAluno = await escrever(cookieAna, { alunoId: ana.alunoProfile.id, texto: TEXTO });
    expect(comoAluno.status).toBe(403);
  });

  it("NÃO deixa o Personal escrever para aluno de outro", async () => {
    const res = await escrever(cookiePersonal, {
      alunoId: alunoDoOutro.alunoProfile.id,
      texto: TEXTO,
    });
    expect(res.status).toBe(404);

    expect(await prisma.feedback.count({ where: { alunoId: alunoDoOutro.alunoProfile.id } })).toBe(
      0
    );
  });
});

describe("Escrever feedback", () => {
  it("registra autor, aluno, data e texto", async () => {
    const res = await escrever(cookiePersonal, { alunoId: ana.alunoProfile.id, texto: TEXTO });
    feedbackDaAna = (await res.json()) as FeedbackItem;

    expect(res.status).toBe(201);
    expect(feedbackDaAna.texto).toBe(TEXTO);
    expect(feedbackDaAna.autor.nome).toBe("Carlos Personal");
    expect(feedbackDaAna.aluno.nome).toBe("Ana Aluna");
    expect(new Date(feedbackDaAna.criadoEm).getTime()).toBeLessThanOrEqual(Date.now());
    // Nasce não lido.
    expect(feedbackDaAna.lido).toBe(false);
    expect(feedbackDaAna.lidoEm).toBeNull();
  });

  it("cria a notificação interna do aluno", async () => {
    const res = await get("/api/notificacoes", cookieAna);
    const data = (await res.json()) as NotificacoesResponse;

    expect(res.status).toBe(200);
    expect(data.naoLidas).toBe(1);
    expect(data.notificacoes[0].tipo).toBe("NOVO_FEEDBACK");
    expect(data.notificacoes[0].titulo).toMatch(/feedback/i);
    expect(data.notificacoes[0].link).toBe("/aluno/feedback");
    expect(data.notificacoes[0].lida).toBe(false);

    // O aviso é só do aluno comentado.
    const doBruno = (await (
      await get("/api/notificacoes", cookieBruno)
    ).json()) as NotificacoesResponse;
    expect(doBruno.notificacoes).toHaveLength(0);
  });

  it("prende o comentário a uma avaliação do próprio aluno", async () => {
    const res = await escrever(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      texto: "Ótima evolução na composição corporal.",
      avaliacaoId: avaliacaoDaAna.id,
    });
    const feedback = (await res.json()) as FeedbackItem;

    expect(res.status).toBe(201);
    expect(feedback.avaliacao?.id).toBe(avaliacaoDaAna.id);
  });

  it("recusa avaliação que não é do aluno", async () => {
    const avaliacaoDoBruno = await createAvaliacao(
      personal.personalProfile.id,
      bruno.alunoProfile.id,
      { peso: 80 }
    );

    const res = await escrever(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      texto: TEXTO,
      avaliacaoId: avaliacaoDoBruno.id,
    });
    expect(res.status).toBe(400);
  });

  it("valida o texto", async () => {
    const curto = await escrever(cookiePersonal, { alunoId: ana.alunoProfile.id, texto: "ok" });
    expect(curto.status).toBe(400);

    const longo = await escrever(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      texto: "x".repeat(2001),
    });
    expect(longo.status).toBe(400);
  });
});

describe("Lista do Personal", () => {
  it("mostra os comentários com status de leitura e o filtro por aluno", async () => {
    const res = await get("/api/personal/feedbacks", cookiePersonal);
    const data = (await res.json()) as FeedbackListResponse;

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.naoLidos).toBe(2);
    expect(data.feedbacks[0].aluno.nome).toBe("Ana Aluna");
    expect(data.alunos).toEqual([{ id: ana.alunoProfile.id, nome: "Ana Aluna", total: 2 }]);
  });

  it("filtra por aluno e busca no texto", async () => {
    const porAluno = (await (
      await get(`/api/personal/feedbacks?alunoId=${bruno.alunoProfile.id}`, cookiePersonal)
    ).json()) as FeedbackListResponse;
    expect(porAluno.feedbacks).toHaveLength(0);

    const porTexto = (await (
      await get("/api/personal/feedbacks?q=consist", cookiePersonal)
    ).json()) as FeedbackListResponse;
    expect(porTexto.feedbacks).toHaveLength(1);
  });

  it("não mostra os comentários de outro Personal", async () => {
    const doOutro = (await (
      await get("/api/personal/feedbacks", cookieOutroPersonal)
    ).json()) as FeedbackListResponse;
    expect(doOutro.feedbacks).toHaveLength(0);
  });
});

describe("O que o aluno vê", () => {
  it("recebe os próprios feedbacks, do mais recente para o mais antigo", async () => {
    const res = await get("/api/aluno/feedbacks", cookieAna);
    const data = (await res.json()) as MeusFeedbacksResponse;

    expect(res.status).toBe(200);
    expect(data.feedbacks).toHaveLength(2);
    expect(data.naoLidos).toBe(2);
    expect(data.feedbacks[0].personal?.nome).toBe("Carlos Personal");

    const datas = data.feedbacks.map((item) => new Date(item.criadoEm).getTime());
    expect(datas[0]).toBeGreaterThanOrEqual(datas[1]);
  });

  it("marca como lidos ao abrir a tela - e silencia a notificação", async () => {
    const res = await fetch(
      `${BASE_URL}/api/aluno/feedbacks/lidos`,
      comCookie(cookieAna, { method: "POST" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.marcados).toBe(2);

    const depois = (await (
      await get("/api/aluno/feedbacks", cookieAna)
    ).json()) as MeusFeedbacksResponse;
    expect(depois.naoLidos).toBe(0);
    expect(depois.feedbacks.every((item) => item.lido)).toBe(true);

    // O Personal passa a ver o comentário como lido.
    const doPersonal = (await (
      await get("/api/personal/feedbacks", cookiePersonal)
    ).json()) as FeedbackListResponse;
    expect(doPersonal.naoLidos).toBe(0);
    expect(doPersonal.feedbacks[0].lidoEm).toBeTruthy();

    // E o sino do aluno para de avisar.
    const notificacoes = (await (
      await get("/api/notificacoes", cookieAna)
    ).json()) as NotificacoesResponse;
    expect(notificacoes.naoLidas).toBe(0);
  });

  it("não vê os comentários de outro aluno", async () => {
    const doBruno = (await (
      await get("/api/aluno/feedbacks", cookieBruno)
    ).json()) as MeusFeedbacksResponse;
    expect(doBruno.feedbacks).toHaveLength(0);
  });
});

describe("Editar e excluir", () => {
  it("corrige o texto sem mexer no status de leitura", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/feedbacks/${feedbackDaAna.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ texto: "Parabéns pela evolução. Vamos manter o ritmo!" }),
      })
    );
    const corrigido = (await res.json()) as FeedbackItem;

    expect(res.status).toBe(200);
    expect(corrigido.texto).toBe("Parabéns pela evolução. Vamos manter o ritmo!");
    expect(corrigido.lido).toBe(true);
  });

  it("NÃO deixa outro Personal editar nem excluir", async () => {
    const patch = await fetch(
      `${BASE_URL}/api/personal/feedbacks/${feedbackDaAna.id}`,
      comCookie(cookieOutroPersonal, { method: "PATCH", body: JSON.stringify({ texto: "Invadido" }) })
    );
    expect(patch.status).toBe(404);

    const del = await fetch(
      `${BASE_URL}/api/personal/feedbacks/${feedbackDaAna.id}`,
      comCookie(cookieOutroPersonal, { method: "DELETE" })
    );
    expect(del.status).toBe(404);
  });

  it("exclui o comentário", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/feedbacks/${feedbackDaAna.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    const doAluno = (await (
      await get("/api/aluno/feedbacks", cookieAna)
    ).json()) as MeusFeedbacksResponse;
    expect(doAluno.feedbacks).toHaveLength(1);
  });
});

describe("Notificações", () => {
  it("cada usuário só marca as próprias como lidas", async () => {
    await escrever(cookiePersonal, { alunoId: bruno.alunoProfile.id, texto: TEXTO });

    const doBruno = (await (
      await get("/api/notificacoes", cookieBruno)
    ).json()) as NotificacoesResponse;
    expect(doBruno.naoLidas).toBe(1);

    // A Ana não consegue marcar a notificação do Bruno.
    const invasao = await fetch(
      `${BASE_URL}/api/notificacoes/${doBruno.notificacoes[0].id}`,
      comCookie(cookieAna, { method: "PATCH" })
    );
    expect(invasao.status).toBe(404);

    const dele = await fetch(
      `${BASE_URL}/api/notificacoes/${doBruno.notificacoes[0].id}`,
      comCookie(cookieBruno, { method: "PATCH" })
    );
    expect(dele.status).toBe(200);

    const depois = (await (
      await get("/api/notificacoes", cookieBruno)
    ).json()) as NotificacoesResponse;
    expect(depois.naoLidas).toBe(0);
  });

  it("exige autenticação", async () => {
    expect((await get("/api/notificacoes")).status).toBe(401);
  });
});
