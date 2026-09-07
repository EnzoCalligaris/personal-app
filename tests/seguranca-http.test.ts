import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { hojeUTC, paraISO, somarDiasUTC } from "@/lib/date-utils";
import { resetDb } from "./db";
import {
  createAluno,
  createAvaliacao,
  createExercicio,
  createExecucao,
  createFeedback,
  createPersonal,
  createProgramacao,
  createTreino,
} from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

/**
 * Auditoria de segurança: em vez de reler o código, esta suíte **tenta** os
 * ataques. Cada caso troca um id na requisição e espera ser barrado.
 *
 * Convenção da aplicação: recurso que existe mas não é seu responde **404**
 * (não 403), para não revelar a existência de dados de terceiros.
 */


/**
 * "X dias depois de hoje", como data de calendário da aplicação.
 *
 * O dia de partida é o de São Paulo, não o do relógio de quem roda a suíte:
 * com o processo em UTC ou em Tóquio, "hoje" seria o dia seguinte a partir
 * das 21h e os testes passariam a marcar na data errada.
 */
function emDias(dias: number) {
  return paraISO(somarDiasUTC(hojeUTC(), dias));
}

type Chamada = { metodo: string; caminho: string; corpo?: unknown };

async function chamar(cookie: string | null, { metodo, caminho, corpo }: Chamada) {
  return fetch(`${BASE_URL}${caminho}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
}

const DIAS_SEMANA = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const;

/* -------------------------------------------------------------------------
   Cenário: dois Personals com dados espelhados, e dois alunos do mesmo
   Personal (para testar aluno x aluno).
   ------------------------------------------------------------------------- */

let personalA: Awaited<ReturnType<typeof createPersonal>>;
let personalB: Awaited<ReturnType<typeof createPersonal>>;
let alunoA1: Awaited<ReturnType<typeof createAluno>>;
let alunoA2: Awaited<ReturnType<typeof createAluno>>;
let alunoB1: Awaited<ReturnType<typeof createAluno>>;

let cookieA = "";
let cookieB = "";
let cookieAlunoA1 = "";
let cookieAlunoA2 = "";

/** Recursos do Personal B - o alvo das tentativas de invasão. */
const alvoB = {
  treinoId: "",
  itemTreinoId: "",
  exercicioId: "",
  programacaoId: "",
  avaliacaoId: "",
  feedbackId: "",
  agendamentoId: "",
  bloqueioId: "",
  faixaId: "",
};

/** Recursos do aluno A2, alvo das tentativas do aluno A1. */
const alvoA2 = { treinoId: "", agendamentoId: "", notificacaoId: "" };

beforeAll(async () => {
  await resetDb();

  personalA = await createPersonal({ name: "Personal A" });
  personalB = await createPersonal({ name: "Personal B" });

  alunoA1 = await createAluno({ name: "Aluno A1", personalId: personalA.personalProfile.id });
  alunoA2 = await createAluno({ name: "Aluno A2", personalId: personalA.personalProfile.id });
  alunoB1 = await createAluno({ name: "Aluno B1", personalId: personalB.personalProfile.id });

  cookieA = (await login(personalA.user.email, SENHA)).cookie;
  cookieB = (await login(personalB.user.email, SENHA)).cookie;
  cookieAlunoA1 = (await login(alunoA1.user.email, SENHA)).cookie;
  cookieAlunoA2 = (await login(alunoA2.user.email, SENHA)).cookie;

  // --- Dados do Personal B ---
  const exercicioB = await createExercicio(personalB.personalProfile.id, { nome: "Supino do B" });
  alvoB.exercicioId = exercicioB.id;

  const treinoB = await createTreino(personalB.personalProfile.id, alunoB1.alunoProfile.id, {
    nome: "Treino do B",
    exercicios: [{ exercicioId: exercicioB.id, ordem: 1, series: 3, repeticoes: "10" }],
  });
  alvoB.treinoId = treinoB.id;

  const itemB = await prisma.treinoExercicio.findFirstOrThrow({ where: { treinoId: treinoB.id } });
  alvoB.itemTreinoId = itemB.id;

  const programacaoB = await createProgramacao(
    personalB.personalProfile.id,
    alunoB1.alunoProfile.id,
    { dias: [{ diaSemana: "SEGUNDA", treinoId: treinoB.id }] }
  );
  alvoB.programacaoId = programacaoB.id;

  const avaliacaoB = await createAvaliacao(
    personalB.personalProfile.id,
    alunoB1.alunoProfile.id,
    { peso: 80 }
  );
  alvoB.avaliacaoId = avaliacaoB.id;

  const feedbackB = await createFeedback(personalB.personalProfile.id, alunoB1.alunoProfile.id, {
    texto: "Comentário privado do Personal B.",
  });
  alvoB.feedbackId = feedbackB.id;

  // Agenda do B: faixa de trabalho, agendamento e bloqueio.
  await prisma.disponibilidade.createMany({
    data: DIAS_SEMANA.map((diaSemana) => ({
      personalId: personalB.personalProfile.id,
      diaSemana,
      horaInicio: "06:00",
      horaFim: "12:00",
      duracaoMin: 60,
    })),
  });
  alvoB.faixaId = (
    await prisma.disponibilidade.findFirstOrThrow({
      where: { personalId: personalB.personalProfile.id },
    })
  ).id;

  const agendamentoB = await prisma.agendamento.create({
    data: {
      personalId: personalB.personalProfile.id,
      alunoId: alunoB1.alunoProfile.id,
      data: hojeUTC(),
      horaInicio: "07:00",
      horaFim: "08:00",
      status: "CONFIRMADO",
    },
  });
  alvoB.agendamentoId = agendamentoB.id;

  const bloqueioB = await prisma.bloqueio.create({
    data: {
      personalId: personalB.personalProfile.id,
      data: new Date(Date.UTC(2026, 8, 20)),
      motivo: "Bloqueio do B",
    },
  });
  alvoB.bloqueioId = bloqueioB.id;

  // --- Dados do aluno A2 (mesmo Personal do A1) ---
  const treinoA2 = await createTreino(personalA.personalProfile.id, alunoA2.alunoProfile.id, {
    nome: "Treino do A2",
    exercicios: [
      {
        exercicioId: (await createExercicio(personalA.personalProfile.id, { nome: "Remada A" })).id,
        ordem: 1,
        series: 3,
        repeticoes: "12",
      },
    ],
  });
  alvoA2.treinoId = treinoA2.id;

  await createExecucao(treinoA2.id, alunoA2.alunoProfile.id, {
    itens: [{ nome: "Remada A", carga: "30kg" }],
  });

  const agendamentoA2 = await prisma.agendamento.create({
    data: {
      personalId: personalA.personalProfile.id,
      alunoId: alunoA2.alunoProfile.id,
      data: hojeUTC(),
      horaInicio: "09:00",
      horaFim: "10:00",
      status: "CONFIRMADO",
    },
  });
  alvoA2.agendamentoId = agendamentoA2.id;

  const notificacaoA2 = await prisma.notificacao.create({
    data: {
      userId: alunoA2.user.id,
      tipo: "NOVO_FEEDBACK",
      titulo: "Recado privado do A2",
      mensagem: "Só o A2 pode ler.",
    },
  });
  alvoA2.notificacaoId = notificacaoA2.id;
}, 90000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

/* -------------------------------------------------------------------------
   1. Usuário não autenticado
   ------------------------------------------------------------------------- */

describe("Sem autenticação", () => {
  const PROTEGIDOS: Chamada[] = [
    { metodo: "GET", caminho: "/api/me" },
    { metodo: "GET", caminho: "/api/notificacoes" },
    { metodo: "POST", caminho: "/api/notificacoes/lidas" },
    { metodo: "POST", caminho: "/api/perfil/foto" },
    { metodo: "GET", caminho: "/api/personal/dashboard" },
    { metodo: "GET", caminho: "/api/personal/alunos" },
    { metodo: "POST", caminho: "/api/personal/alunos", corpo: { name: "X", email: "x@x.com" } },
    { metodo: "GET", caminho: "/api/personal/treinos" },
    { metodo: "POST", caminho: "/api/personal/treinos", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/exercicios" },
    { metodo: "GET", caminho: "/api/personal/avaliacoes" },
    { metodo: "POST", caminho: "/api/personal/avaliacoes", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/feedbacks" },
    { metodo: "POST", caminho: "/api/personal/feedbacks", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/agenda?vista=semana" },
    { metodo: "GET", caminho: "/api/personal/agenda/trabalho" },
    { metodo: "GET", caminho: "/api/personal/agenda/regras" },
    { metodo: "PUT", caminho: "/api/personal/agenda/regras", corpo: {} },
    { metodo: "POST", caminho: "/api/personal/agendamentos", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/perfil" },
    { metodo: "PATCH", caminho: "/api/personal/perfil", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/programacoes?alunoId=x" },
    { metodo: "GET", caminho: "/api/aluno/dashboard" },
    { metodo: "GET", caminho: "/api/aluno/treinos" },
    { metodo: "GET", caminho: "/api/aluno/agenda" },
    { metodo: "GET", caminho: "/api/aluno/agenda/dias" },
    { metodo: "POST", caminho: "/api/aluno/agendamentos", corpo: {} },
    { metodo: "GET", caminho: "/api/aluno/evolucao" },
    { metodo: "GET", caminho: "/api/aluno/progresso" },
    { metodo: "GET", caminho: "/api/aluno/historico" },
    { metodo: "GET", caminho: "/api/aluno/feedbacks" },
    { metodo: "POST", caminho: "/api/aluno/feedbacks/lidos" },
    { metodo: "GET", caminho: "/api/aluno/perfil" },
    { metodo: "PATCH", caminho: "/api/aluno/perfil", corpo: {} },
  ];

  it("responde 401 em todos os endpoints protegidos", async () => {
    for (const chamada of PROTEGIDOS) {
      const res = await chamar(null, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(401);
    }
  });

  it("responde 401 também nas rotas com id", async () => {
    const comId: Chamada[] = [
      { metodo: "GET", caminho: `/api/alunos/${alunoA1.alunoProfile.id}` },
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoA1.alunoProfile.id}` },
      { metodo: "GET", caminho: `/api/personal/treinos/${alvoB.treinoId}` },
      { metodo: "DELETE", caminho: `/api/personal/avaliacoes/${alvoB.avaliacaoId}` },
      { metodo: "PATCH", caminho: `/api/notificacoes/${alvoA2.notificacaoId}` },
      { metodo: "GET", caminho: `/api/aluno/treinos/${alvoA2.treinoId}` },
    ];

    for (const chamada of comId) {
      const res = await chamar(null, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(401);
    }
  });

  it("não vaza dados no corpo da resposta negada", async () => {
    const res = await chamar(null, { metodo: "GET", caminho: "/api/personal/alunos" });
    const corpo = await res.text();

    expect(corpo).not.toContain("Aluno A1");
    expect(corpo).not.toContain("@example.com");
  });
});

/* -------------------------------------------------------------------------
   2. Aluno tentando endpoints administrativos
   ------------------------------------------------------------------------- */

describe("Aluno em endpoints administrativos", () => {
  const ADMINISTRATIVOS: Chamada[] = [
    { metodo: "GET", caminho: "/api/personal/dashboard" },
    { metodo: "GET", caminho: "/api/personal/alunos" },
    { metodo: "POST", caminho: "/api/personal/alunos", corpo: { name: "Invadido", email: "inv@example.com" } },
    { metodo: "GET", caminho: "/api/personal/treinos" },
    { metodo: "POST", caminho: "/api/personal/treinos", corpo: { alunoId: "x", nome: "Invadido" } },
    { metodo: "GET", caminho: "/api/personal/exercicios" },
    { metodo: "GET", caminho: "/api/personal/avaliacoes" },
    { metodo: "POST", caminho: "/api/personal/avaliacoes", corpo: { alunoId: "x" } },
    { metodo: "GET", caminho: "/api/personal/feedbacks" },
    { metodo: "POST", caminho: "/api/personal/feedbacks", corpo: { alunoId: "x", texto: "oi" } },
    { metodo: "GET", caminho: "/api/personal/agenda?vista=dia" },
    { metodo: "GET", caminho: "/api/personal/agenda/trabalho" },
    { metodo: "POST", caminho: "/api/personal/agenda/trabalho", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/agenda/regras" },
    { metodo: "PUT", caminho: "/api/personal/agenda/regras", corpo: { permiteAgendamento: true } },
    { metodo: "POST", caminho: "/api/personal/agenda/bloqueios", corpo: {} },
    { metodo: "POST", caminho: "/api/personal/agendamentos", corpo: {} },
    { metodo: "GET", caminho: "/api/personal/perfil" },
    { metodo: "PATCH", caminho: "/api/personal/perfil", corpo: { nome: "Invadido" } },
  ];

  it("responde 403 em todos", async () => {
    for (const chamada of ADMINISTRATIVOS) {
      const res = await chamar(cookieAlunoA1, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(403);
    }
  });

  it("responde 403 nas rotas administrativas com id", async () => {
    const comId: Chamada[] = [
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoA2.alunoProfile.id}` },
      { metodo: "PATCH", caminho: `/api/personal/alunos/${alunoA2.alunoProfile.id}`, corpo: { name: "Invadido" } },
      { metodo: "GET", caminho: `/api/personal/treinos/${alvoA2.treinoId}` },
      { metodo: "DELETE", caminho: `/api/personal/treinos/${alvoA2.treinoId}` },
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoA2.alunoProfile.id}/calendario` },
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoA2.alunoProfile.id}/treino-do-dia` },
      { metodo: "PATCH", caminho: `/api/personal/agendamentos/${alvoA2.agendamentoId}`, corpo: { status: "CANCELADO" } },
    ];

    for (const chamada of comId) {
      const res = await chamar(cookieAlunoA1, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(403);
    }
  });

  it("nada foi alterado pelas tentativas", async () => {
    const treino = await prisma.treino.findUniqueOrThrow({ where: { id: alvoA2.treinoId } });
    expect(treino.nome).toBe("Treino do A2");

    const agendamento = await prisma.agendamento.findUniqueOrThrow({
      where: { id: alvoA2.agendamentoId },
    });
    expect(agendamento.status).toBe("CONFIRMADO");
  });
});

/* -------------------------------------------------------------------------
   3. Personal em endpoints do aluno
   ------------------------------------------------------------------------- */

describe("Personal em endpoints do aluno", () => {
  it("responde 403 em toda a área do aluno", async () => {
    const doAluno: Chamada[] = [
      { metodo: "GET", caminho: "/api/aluno/dashboard" },
      { metodo: "GET", caminho: "/api/aluno/treinos" },
      { metodo: "GET", caminho: "/api/aluno/historico" },
      { metodo: "GET", caminho: "/api/aluno/evolucao" },
      { metodo: "GET", caminho: "/api/aluno/progresso" },
      { metodo: "GET", caminho: "/api/aluno/feedbacks" },
      { metodo: "POST", caminho: "/api/aluno/feedbacks/lidos" },
      { metodo: "GET", caminho: "/api/aluno/agenda" },
      { metodo: "GET", caminho: "/api/aluno/agenda/dias" },
      { metodo: "GET", caminho: `/api/aluno/agenda/horarios?data=${emDias(3)}` },
      { metodo: "POST", caminho: "/api/aluno/agendamentos", corpo: {} },
      { metodo: "GET", caminho: "/api/aluno/perfil" },
      { metodo: "PATCH", caminho: "/api/aluno/perfil", corpo: { nome: "Invadido" } },
      { metodo: "GET", caminho: `/api/aluno/treinos/${alvoA2.treinoId}` },
      { metodo: "POST", caminho: `/api/aluno/treinos/${alvoA2.treinoId}/execucoes`, corpo: {} },
    ];

    for (const chamada of doAluno) {
      const res = await chamar(cookieA, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(403);
    }
  });
});

/* -------------------------------------------------------------------------
   4. Aluno tentando acessar outro aluno (IDOR)
   ------------------------------------------------------------------------- */

describe("Aluno acessando outro aluno", () => {
  it("NÃO abre a ficha de treino do outro", async () => {
    const res = await get(`/api/aluno/treinos/${alvoA2.treinoId}`, cookieAlunoA1);
    expect(res.status).toBe(404);
  });

  it("NÃO registra execução no treino do outro", async () => {
    const res = await chamar(cookieAlunoA1, {
      metodo: "POST",
      caminho: `/api/aluno/treinos/${alvoA2.treinoId}/execucoes`,
      corpo: {},
    });
    expect(res.status).toBe(404);

    const execucoes = await prisma.historicoTreino.count({
      where: { alunoId: alunoA1.alunoProfile.id },
    });
    expect(execucoes).toBe(0);
  });

  it("NÃO cancela nem remarca o agendamento do outro", async () => {
    const cancelar = await chamar(cookieAlunoA1, {
      metodo: "PATCH",
      caminho: `/api/aluno/agendamentos/${alvoA2.agendamentoId}`,
      corpo: { status: "CANCELADO" },
    });
    expect(cancelar.status).toBe(404);

    const agendamento = await prisma.agendamento.findUniqueOrThrow({
      where: { id: alvoA2.agendamentoId },
    });
    expect(agendamento.status).toBe("CONFIRMADO");
  });

  it("NÃO lê o perfil do outro pelo endpoint com id", async () => {
    const res = await get(`/api/alunos/${alunoA2.alunoProfile.id}`, cookieAlunoA1);
    expect(res.status).toBe(404);

    // O próprio continua acessível.
    const proprio = await get(`/api/alunos/${alunoA1.alunoProfile.id}`, cookieAlunoA1);
    expect(proprio.status).toBe(200);
  });

  it("NÃO marca a notificação do outro", async () => {
    const res = await chamar(cookieAlunoA1, {
      metodo: "PATCH",
      caminho: `/api/notificacoes/${alvoA2.notificacaoId}`,
    });
    expect(res.status).toBe(404);

    const notificacao = await prisma.notificacao.findUniqueOrThrow({
      where: { id: alvoA2.notificacaoId },
    });
    expect(notificacao.lida).toBe(false);
  });

  it("as listagens do aluno trazem apenas os próprios dados", async () => {
    const treinos = await (await get("/api/aluno/treinos", cookieAlunoA1)).json();
    const historico = await (await get("/api/aluno/historico", cookieAlunoA1)).json();
    const notificacoes = await (await get("/api/notificacoes", cookieAlunoA1)).json();
    const feedbacks = await (await get("/api/aluno/feedbacks", cookieAlunoA1)).json();

    expect(treinos.treinos).toHaveLength(0);
    expect(historico.execucoes).toHaveLength(0);
    expect(notificacoes.notificacoes).toHaveLength(0);
    expect(feedbacks.feedbacks).toHaveLength(0);

    // E o A2 continua vendo o que é dele.
    const doA2 = await (await get("/api/aluno/treinos", cookieAlunoA2)).json();
    expect(doA2.treinos).toHaveLength(1);
  });

  it("NÃO altera o próprio vínculo, status ou e-mail pelo perfil", async () => {
    const res = await chamar(cookieAlunoA1, {
      metodo: "PATCH",
      caminho: "/api/aluno/perfil",
      corpo: {
        nome: "Aluno A1",
        personalId: personalB.personalProfile.id,
        status: "INATIVO",
        email: "novo@example.com",
        alunoId: alunoA2.alunoProfile.id,
      },
    });
    expect(res.status).toBe(200);

    const perfil = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: alunoA1.alunoProfile.id },
      include: { user: { select: { email: true } } },
    });
    expect(perfil.personalId).toBe(personalA.personalProfile.id);
    expect(perfil.status).toBe("ATIVO");
    expect(perfil.user.email).toBe(alunoA1.user.email);
  });
});

/* -------------------------------------------------------------------------
   5. Personal tentando acessar dados de outro Personal (IDOR)
   ------------------------------------------------------------------------- */

describe("Personal acessando dados de outro Personal", () => {
  it("responde 404 em toda leitura por id", async () => {
    const leituras: Chamada[] = [
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoB1.alunoProfile.id}` },
      { metodo: "GET", caminho: `/api/personal/treinos/${alvoB.treinoId}` },
      { metodo: "GET", caminho: `/api/personal/exercicios/${alvoB.exercicioId}` },
      { metodo: "GET", caminho: `/api/personal/programacoes/${alvoB.programacaoId}` },
      { metodo: "GET", caminho: `/api/personal/avaliacoes/${alvoB.avaliacaoId}` },
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoB1.alunoProfile.id}/calendario` },
      { metodo: "GET", caminho: `/api/personal/alunos/${alunoB1.alunoProfile.id}/treino-do-dia` },
      { metodo: "GET", caminho: `/api/personal/programacoes?alunoId=${alunoB1.alunoProfile.id}` },
    ];

    for (const chamada of leituras) {
      const res = await chamar(cookieA, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(404);
    }
  });

  it("responde 404 em toda escrita por id", async () => {
    const escritas: Chamada[] = [
      { metodo: "PATCH", caminho: `/api/personal/alunos/${alunoB1.alunoProfile.id}`, corpo: { name: "Invadido" } },
      { metodo: "PATCH", caminho: `/api/personal/treinos/${alvoB.treinoId}`, corpo: { nome: "Invadido" } },
      { metodo: "DELETE", caminho: `/api/personal/treinos/${alvoB.treinoId}` },
      { metodo: "POST", caminho: `/api/personal/treinos/${alvoB.treinoId}/duplicar`, corpo: {} },
      { metodo: "POST", caminho: `/api/personal/treinos/${alvoB.treinoId}/exercicios`, corpo: { exercicioId: alvoB.exercicioId, series: 3, repeticoes: "10" } },
      { metodo: "PATCH", caminho: `/api/personal/treinos/${alvoB.treinoId}/exercicios/${alvoB.itemTreinoId}`, corpo: { series: 10 } },
      { metodo: "DELETE", caminho: `/api/personal/treinos/${alvoB.treinoId}/exercicios/${alvoB.itemTreinoId}` },
      { metodo: "PUT", caminho: `/api/personal/treinos/${alvoB.treinoId}/exercicios/ordem`, corpo: { itens: [alvoB.itemTreinoId] } },
      { metodo: "PATCH", caminho: `/api/personal/exercicios/${alvoB.exercicioId}`, corpo: { nome: "Invadido" } },
      { metodo: "DELETE", caminho: `/api/personal/exercicios/${alvoB.exercicioId}` },
      { metodo: "PATCH", caminho: `/api/personal/programacoes/${alvoB.programacaoId}`, corpo: { nome: "Invadido" } },
      { metodo: "DELETE", caminho: `/api/personal/programacoes/${alvoB.programacaoId}` },
      // Aponta para um treino do PRÓPRIO A: se passasse, a mudança seria
      // visível no banco (mandar o treino que já está lá esconderia a falha).
      { metodo: "PUT", caminho: `/api/personal/programacoes/${alvoB.programacaoId}/dias/SEGUNDA`, corpo: { treinoId: alvoA2.treinoId } },
      { metodo: "DELETE", caminho: `/api/personal/programacoes/${alvoB.programacaoId}/dias/SEGUNDA` },
      { metodo: "PATCH", caminho: `/api/personal/avaliacoes/${alvoB.avaliacaoId}`, corpo: { peso: 50 } },
      { metodo: "DELETE", caminho: `/api/personal/avaliacoes/${alvoB.avaliacaoId}` },
      { metodo: "PATCH", caminho: `/api/personal/feedbacks/${alvoB.feedbackId}`, corpo: { texto: "Invadido pelo A" } },
      { metodo: "DELETE", caminho: `/api/personal/feedbacks/${alvoB.feedbackId}` },
      { metodo: "PATCH", caminho: `/api/personal/agendamentos/${alvoB.agendamentoId}`, corpo: { status: "CANCELADO" } },
      { metodo: "DELETE", caminho: `/api/personal/agenda/bloqueios/${alvoB.bloqueioId}` },
      { metodo: "DELETE", caminho: `/api/personal/agenda/trabalho/${alvoB.faixaId}` },
    ];

    for (const chamada of escritas) {
      const res = await chamar(cookieA, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(404);
    }
  });

  it("nada do Personal B foi alterado", async () => {
    const aluno = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: alunoB1.alunoProfile.id },
      include: { user: { select: { name: true } } },
    });
    expect(aluno.user.name).toBe("Aluno B1");
    expect(aluno.personalId).toBe(personalB.personalProfile.id);
    expect(aluno.status).toBe("ATIVO");

    const treino = await prisma.treino.findUniqueOrThrow({ where: { id: alvoB.treinoId } });
    expect(treino.nome).toBe("Treino do B");
    // O aluno do B não ganhou treino nenhum vindo do A (duplicar, criar).
    expect(await prisma.treino.count({ where: { alunoId: alunoB1.alunoProfile.id } })).toBe(1);

    // A ficha continua com exatamente o item original: nada foi apagado pelo
    // DELETE nem acrescentado pelo POST. Conferir no banco é o que pega uma
    // escrita que aconteceu antes de a rota responder 404.
    const itens = await prisma.treinoExercicio.findMany({ where: { treinoId: alvoB.treinoId } });
    expect(itens).toHaveLength(1);
    expect(itens[0].id).toBe(alvoB.itemTreinoId);
    expect(itens[0].series).toBe(3);

    const exercicio = await prisma.exercicio.findUniqueOrThrow({ where: { id: alvoB.exercicioId } });
    expect(exercicio.nome).toBe("Supino do B");

    const avaliacao = await prisma.avaliacao.findUniqueOrThrow({ where: { id: alvoB.avaliacaoId } });
    expect(avaliacao.peso).toBe(80);

    const feedback = await prisma.feedback.findUniqueOrThrow({ where: { id: alvoB.feedbackId } });
    expect(feedback.texto).toBe("Comentário privado do Personal B.");

    const agendamento = await prisma.agendamento.findUniqueOrThrow({
      where: { id: alvoB.agendamentoId },
    });
    expect(agendamento.status).toBe("CONFIRMADO");

    expect(await prisma.bloqueio.findUnique({ where: { id: alvoB.bloqueioId } })).not.toBeNull();
    expect(await prisma.disponibilidade.findUnique({ where: { id: alvoB.faixaId } })).not.toBeNull();

    // A programação e o dia dela seguem apontando para o treino do B (o PUT e
    // o DELETE em /dias/SEGUNDA não passaram).
    const programacao = await prisma.programacao.findUniqueOrThrow({
      where: { id: alvoB.programacaoId },
      include: { dias: true },
    });
    expect(programacao.nome).toBe("Programação de teste");
    expect(programacao.dias).toHaveLength(1);
    expect(programacao.dias[0].diaSemana).toBe("SEGUNDA");
    expect(programacao.dias[0].treinoId).toBe(alvoB.treinoId);

    // Controle positivo: para o dono, tudo continua acessível normalmente.
    expect((await get(`/api/personal/treinos/${alvoB.treinoId}`, cookieB)).status).toBe(200);
    expect((await get(`/api/personal/alunos/${alunoB1.alunoProfile.id}`, cookieB)).status).toBe(200);
    expect((await get(`/api/personal/avaliacoes/${alvoB.avaliacaoId}`, cookieB)).status).toBe(200);
  });

  it("NÃO cria recursos para aluno de outro Personal", async () => {
    const criacoes: Chamada[] = [
      { metodo: "POST", caminho: "/api/personal/treinos", corpo: { alunoId: alunoB1.alunoProfile.id, nome: "Invasão" } },
      { metodo: "POST", caminho: "/api/personal/avaliacoes", corpo: { alunoId: alunoB1.alunoProfile.id, peso: 70 } },
      { metodo: "POST", caminho: "/api/personal/feedbacks", corpo: { alunoId: alunoB1.alunoProfile.id, texto: "Feedback invasor." } },
      { metodo: "POST", caminho: "/api/personal/programacoes", corpo: { alunoId: alunoB1.alunoProfile.id, dataInicio: emDias(0) } },
      { metodo: "POST", caminho: "/api/personal/agendamentos", corpo: { alunoId: alunoB1.alunoProfile.id, data: emDias(3), horaInicio: "07:00", horaFim: "08:00" } },
      { metodo: "POST", caminho: `/api/personal/alunos/${alunoB1.alunoProfile.id}/avatar` },
    ];

    for (const chamada of criacoes) {
      const res = await chamar(cookieA, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(404);
    }

    // Nenhum registro sobrou no aluno do outro Personal.
    const alunoId = alunoB1.alunoProfile.id;
    expect(await prisma.treino.count({ where: { alunoId, personalId: personalA.personalProfile.id } })).toBe(0);
    expect(await prisma.avaliacao.count({ where: { alunoId, personalId: personalA.personalProfile.id } })).toBe(0);
    expect(await prisma.feedback.count({ where: { alunoId, personalId: personalA.personalProfile.id } })).toBe(0);
    expect(await prisma.agendamento.count({ where: { alunoId, personalId: personalA.personalProfile.id } })).toBe(0);
  });

  it("NÃO transfere um treino próprio para aluno de outro Personal", async () => {
    const meuTreino = await createTreino(
      personalA.personalProfile.id,
      alunoA1.alunoProfile.id,
      { nome: "Treino do A1" }
    );

    const res = await chamar(cookieA, {
      metodo: "PATCH",
      caminho: `/api/personal/treinos/${meuTreino.id}`,
      corpo: { alunoId: alunoB1.alunoProfile.id },
    });
    expect(res.status).toBe(404);

    const treino = await prisma.treino.findUniqueOrThrow({ where: { id: meuTreino.id } });
    expect(treino.alunoId).toBe(alunoA1.alunoProfile.id);
  });

  it("NÃO usa exercício da biblioteca alheia em treino próprio", async () => {
    const meuTreino = await prisma.treino.findFirstOrThrow({
      where: { personalId: personalA.personalProfile.id, alunoId: alunoA1.alunoProfile.id },
    });

    const res = await chamar(cookieA, {
      metodo: "POST",
      caminho: `/api/personal/treinos/${meuTreino.id}/exercicios`,
      corpo: { exercicioId: alvoB.exercicioId, series: 3, repeticoes: "10" },
    });
    expect(res.status).toBe(404);
  });

  it("as listagens do Personal trazem apenas os próprios dados", async () => {
    const alunos = await (await get("/api/personal/alunos", cookieA)).json();
    const treinos = await (await get("/api/personal/treinos?status=TODOS", cookieA)).json();
    const exercicios = await (await get("/api/personal/exercicios?status=TODOS", cookieA)).json();
    const avaliacoes = await (await get("/api/personal/avaliacoes", cookieA)).json();
    const feedbacks = await (await get("/api/personal/feedbacks", cookieA)).json();
    const agenda = await (await get("/api/personal/agenda?vista=mes", cookieA)).json();

    const texto = JSON.stringify({ alunos, treinos, exercicios, avaliacoes, feedbacks, agenda });

    expect(texto).not.toContain("Aluno B1");
    expect(texto).not.toContain("Treino do B");
    expect(texto).not.toContain("Supino do B");
    expect(texto).not.toContain("Comentário privado do Personal B");
  });
});

/* -------------------------------------------------------------------------
   6. Validação de entrada
   ------------------------------------------------------------------------- */

describe("Validação de dados", () => {
  it("recusa corpo inválido com 400, sem erro de servidor", async () => {
    const invalidos: Chamada[] = [
      { metodo: "POST", caminho: "/api/personal/alunos", corpo: { name: "A", email: "sem-arroba" } },
      { metodo: "POST", caminho: "/api/personal/treinos", corpo: { alunoId: "nao-e-uuid", nome: "" } },
      { metodo: "POST", caminho: "/api/personal/avaliacoes", corpo: { alunoId: "nao-e-uuid", peso: 999 } },
      { metodo: "POST", caminho: "/api/personal/feedbacks", corpo: { alunoId: "nao-e-uuid", texto: "" } },
      { metodo: "PUT", caminho: "/api/personal/agenda/regras", corpo: { janelaDias: 9999 } },
      { metodo: "POST", caminho: "/api/personal/agenda/trabalho", corpo: { diaSemana: "FERIADO", horaInicio: "25:00", horaFim: "26:00" } },
      { metodo: "PATCH", caminho: "/api/personal/perfil", corpo: { nome: "A" } },
    ];

    for (const chamada of invalidos) {
      const res = await chamar(cookieA, chamada);
      expect(res.status, `${chamada.metodo} ${chamada.caminho}`).toBe(400);
    }
  });

  it("corpo ausente ou não-JSON não derruba o servidor", async () => {
    const res = await fetch(`${BASE_URL}/api/personal/treinos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: "isto não é json",
    });
    expect(res.status).toBe(400);
  });

  it("id inexistente ou malformado responde 404, nunca 500", async () => {
    const ids = ["00000000-0000-0000-0000-000000000000", "nao-e-uuid", "../../etc/passwd"];

    for (const id of ids) {
      const res = await get(`/api/personal/treinos/${encodeURIComponent(id)}`, cookieA);
      expect([400, 404], `id ${id}`).toContain(res.status);
    }
  });
});

/* -------------------------------------------------------------------------
   7. Sessão, cabeçalhos e CORS
   ------------------------------------------------------------------------- */

describe("Sessão e cabeçalhos", () => {
  it("o cookie de sessão é HttpOnly e SameSite", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: alunoA1.user.email, password: SENHA }),
    });

    const cookies = res.headers.getSetCookie();
    const sessao = cookies.filter((cookie) => cookie.startsWith("sb-"));
    expect(sessao.length).toBeGreaterThan(0);

    for (const cookie of sessao) {
      // O cookie carrega o refresh token: fora do alcance de JavaScript.
      expect(cookie, cookie.slice(0, 40)).toMatch(/HttpOnly/i);
      expect(cookie, cookie.slice(0, 40)).toMatch(/SameSite=lax/i);
    }
  });

  it("o login não revela se o e-mail existe", async () => {
    const inexistente = await login("ninguem-aqui@example.com", "SenhaErrada@123");
    const senhaErrada = await login(alunoA1.user.email, "SenhaErrada@123");

    expect(inexistente.status).toBe(401);
    expect(senhaErrada.status).toBe(401);
    expect(inexistente.body.error).toBe(senhaErrada.body.error);
  });

  it("a recuperação de senha responde igual para e-mail existente e inexistente", async () => {
    const pedir = (email: string) =>
      fetch(`${BASE_URL}/api/auth/esqueci-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

    const existente = await pedir(alunoA1.user.email);
    const inexistente = await pedir("ninguem-aqui@example.com");

    expect(existente.status).toBe(inexistente.status);
    expect(await existente.text()).toBe(await inexistente.text());
  });

  it("as respostas trazem os cabeçalhos de segurança", async () => {
    const res = await get("/api/me", cookieAlunoA1);

    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    // Resposta de um usuário específico nunca vai para cache compartilhado.
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("não libera CORS para outra origem", async () => {
    const res = await fetch(`${BASE_URL}/api/personal/alunos`, {
      headers: { Cookie: cookieA, Origin: "https://site-malicioso.example" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("depois do logout o cookie não vale mais", async () => {
    const entrada = await login(alunoA2.user.email, SENHA);
    expect((await get("/api/me", entrada.cookie)).status).toBe(200);

    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: entrada.cookie },
    });

    expect((await get("/api/me", entrada.cookie)).status).toBe(401);
  });
});
