import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/date-utils";
import { meuDashboard } from "@/lib/aluno/queries";
import { getDashboardData } from "@/lib/dashboard/queries";
import { resetDb } from "./db";
import {
  createAgendamento,
  createAluno,
  createAvaliacao,
  createExecucao,
  createFeedback,
  createPersonal,
  createProgramacao,
  createTreino,
} from "./factories";

/**
 * O que os dois dashboards devolvem.
 *
 * As consultas que não dependem umas das outras passaram a sair juntas, para o
 * dashboard não somar uma ida ao banco atrás da outra sem necessidade. Nada do
 * que é devolvido mudou - e é isso que estes testes prendem: os mesmos números,
 * a mesma ordem, as mesmas datas, o mesmo erro quando falta o perfil.
 *
 * O relógio é fixo, então "hoje" é sempre o mesmo dia em qualquer fuso e em
 * qualquer hora em que a suíte rode.
 */

/** Meio-dia de uma quarta-feira em São Paulo. */
const AGORA = new Date("2026-09-16T15:00:00Z");
const HOJE = "2026-09-16";

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
/** Um aluno recém-criado, sem nada: o dashboard tem que abrir mesmo assim. */
let novato: Awaited<ReturnType<typeof createAluno>>;
let treinoDeHoje: Awaited<ReturnType<typeof createTreino>>;

/** Conta as consultas que uma ação dispara. */
async function consultas(acao: () => Promise<unknown>): Promise<number> {
  const registradas: string[] = [];
  const ouvinte = (evento: { query: string }) => registradas.push(evento.query);

  (prisma as unknown as { $on: (e: string, cb: typeof ouvinte) => void }).$on("query", ouvinte);
  await acao();
  await new Promise((resolve) => setTimeout(resolve, 60));

  return registradas.length;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Painel" });
  ana = await createAluno({ name: "Ana Painel", personalId: personal.personalProfile.id });
  novato = await createAluno({ name: "Novato Vazio", personalId: personal.personalProfile.id });

  treinoDeHoje = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A · Superior",
  });

  // Todos os dias têm treino: o previsto não depende do dia da semana.
  await createProgramacao(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Bloco de força",
    dataInicio: dataUTC("2026-08-01"),
    dias: (
      ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const
    ).map((diaSemana) => ({ diaSemana, treinoId: treinoDeHoje.id })),
  });

  // Três execuções: duas dentro da semana corrente, uma bem antes.
  for (const iso of ["2026-09-14", "2026-09-15", "2026-07-10"]) {
    await createExecucao(treinoDeHoje.id, ana.alunoProfile.id, {
      dataExecucao: new Date(`${iso}T12:00:00-03:00`),
    });
  }

  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataUTC(HOJE),
    horaInicio: "07:00",
    horaFim: "08:00",
    status: "CONFIRMADO",
  });
  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataUTC("2026-09-18"),
    horaInicio: "07:00",
    horaFim: "08:00",
    status: "AGENDADO",
  });

  await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataUTC("2026-09-10"),
    peso: 62.4,
    percentualGordura: 24.1,
  });
  await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataUTC("2026-08-10"),
    peso: 65,
    percentualGordura: 26,
  });

  await createFeedback(personal.personalProfile.id, ana.alunoProfile.id, {
    texto: "Ótima constância nesta semana.",
  });
}, 120000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("F) Dashboard do aluno, com dados", () => {
  it("devolve exatamente os números esperados", async () => {
    const dados = await meuDashboard(ana.alunoProfile.id, AGORA);

    expect(dados.aluno.nome).toBe("Ana Painel");
    expect(dados.aluno.primeiroNome).toBe("Ana");

    // D) O dia é o de São Paulo, e o previsto é o treino da programação.
    expect(dados.hoje.data).toBe(HOJE);
    expect(dados.hoje.tipo).toBe("TREINO");
    expect(dados.hoje.treino?.nome).toBe("Treino A · Superior");
    expect(dados.hoje.executado).toBe(false);
    expect(dados.hoje.agendamento?.horaInicio).toBe("07:00");

    expect(dados.proximo?.data).toBe("2026-09-17");

    // H) As contagens da semana e o total.
    expect(dados.resumo.treinosNaSemana).toBe(7);
    expect(dados.resumo.concluidosNaSemana).toBe(2);
    expect(dados.resumo.totalExecucoes).toBe(3);

    expect(dados.ultimoFeedback?.texto).toBe("Ótima constância nesta semana.");
    expect(dados.personal?.nome).toBe("Carlos Painel");
    expect(dados.evolucao).not.toBeNull();
  }, 60000);

  it("C) a evolução vem da avaliação mais recente", async () => {
    const dados = await meuDashboard(ana.alunoProfile.id, AGORA);
    expect(dados.evolucao.ultima?.peso).toBe(62.4);
    expect(dados.evolucao.avaliacoes.map((a) => a.peso)).toEqual([65, 62.4]);
  }, 60000);

  it("D) o mesmo instante devolve o mesmo dia, venha de que fuso vier", async () => {
    const original = process.env.TZ;
    try {
      const respostas: string[] = [];
      for (const fuso of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
        process.env.TZ = fuso;
        const dados = await meuDashboard(ana.alunoProfile.id, AGORA);
        respostas.push(`${dados.hoje.data}|${dados.proximo?.data}|${dados.resumo.sequencia}`);
      }
      expect(new Set(respostas).size, "os três fusos deveriam concordar").toBe(1);
      expect(respostas[0].startsWith(HOJE)).toBe(true);
    } finally {
      process.env.TZ = original;
    }
  }, 60000);
});

describe("E) Dashboard do aluno, sem nada", () => {
  it("abre para quem acabou de entrar", async () => {
    const dados = await meuDashboard(novato.alunoProfile.id, AGORA);

    expect(dados.aluno.nome).toBe("Novato Vazio");
    expect(dados.hoje.data).toBe(HOJE);
    expect(dados.hoje.tipo).toBe("SEM_PROGRAMACAO");
    expect(dados.hoje.treino).toBeNull();
    expect(dados.proximo).toBeNull();
    expect(dados.resumo.treinosNaSemana).toBe(0);
    expect(dados.resumo.concluidosNaSemana).toBe(0);
    expect(dados.resumo.totalExecucoes).toBe(0);
    expect(dados.resumo.sequencia).toBe(0);
    expect(dados.ultimoFeedback).toBeNull();
  }, 60000);
});

describe("G) Quando falta o perfil", () => {
  it("continua sendo erro, com a mesma mensagem", async () => {
    await expect(meuDashboard("nao-existe-esse-id", AGORA)).rejects.toThrow(
      /Perfil de aluno não encontrado/
    );
  }, 60000);
});

describe("F) Dashboard do Personal", () => {
  it("devolve os números, a agenda e os alunos do próprio Personal", async () => {
    const dados = await getDashboardData(personal.personalProfile.id, AGORA);

    expect(dados.resumo.totalAlunos).toBe(2);
    expect(dados.resumo.alunosAtivos).toBe(2);
    expect(dados.resumo.treinosDoDia).toBe(1);
    expect(dados.resumo.proximosAgendamentos).toBe(1);
    // A de 37 dias atrás está fora da janela de atividade do resumo.
    expect(dados.resumo.avaliacoesRecentes).toBe(1);

    // O atendimento de hoje, com o treino que a programação prevê.
    expect(dados.agendaDoDia).toHaveLength(1);
    expect(dados.agendaDoDia[0].aluno.nome).toBe("Ana Painel");
    expect(dados.agendaDoDia[0].treino?.nome).toBe("Treino A · Superior");

    expect(dados.proximosAgendamentos).toHaveLength(1);
    expect(dados.proximosAgendamentos[0].data.slice(0, 10)).toBe("2026-09-18");

    // C) Alunos mais recentes primeiro, e o próximo treino de cada um.
    expect(dados.alunosRecentes.map((a) => a.nome)).toEqual(["Novato Vazio", "Ana Painel"]);
    const naLista = dados.alunosRecentes.find((a) => a.nome === "Ana Painel");
    expect(naLista?.proximoTreino?.nome).toBe("Treino A · Superior");
    expect(naLista?.totalTreinos).toBe(1);

    // C) Avaliações da mais nova para a mais antiga.
    expect(dados.avaliacoesRecentes.map((a) => a.peso)).toEqual([62.4, 65]);
  }, 60000);

  it("B) o Personal só enxerga o que é dele", async () => {
    const outro = await createPersonal({ name: "Marina Alheia" });
    const dados = await getDashboardData(outro.personalProfile.id, AGORA);

    expect(dados.resumo.totalAlunos).toBe(0);
    expect(dados.agendaDoDia).toEqual([]);
    expect(dados.proximosAgendamentos).toEqual([]);
    expect(dados.alunosRecentes).toEqual([]);
    expect(dados.avaliacoesRecentes).toEqual([]);
  }, 60000);
});

describe("H) O número de consultas não cresceu", () => {
  /**
   * Sair junto não é sair mais vezes: são as mesmas consultas, com os mesmos
   * filtros, apenas sem esperar umas pelas outras. Com este cenário, os números
   * medidos antes e depois da mudança foram os mesmos - 34 e 27.
   *
   * Os tetos têm uma folga pequena de propósito: servem para pegar uma consulta
   * nova por registro, que é como um N+1 aparece, e não para congelar o número
   * exato.
   */
  it("o dashboard do aluno cabe no orçamento", async () => {
    const quantas = await consultas(() => meuDashboard(ana.alunoProfile.id, AGORA));
    expect(quantas).toBeGreaterThan(0);
    expect(quantas).toBeLessThanOrEqual(38);
  }, 60000);

  it("o do Personal também", async () => {
    const quantas = await consultas(() => getDashboardData(personal.personalProfile.id, AGORA));
    expect(quantas).toBeGreaterThan(0);
    expect(quantas).toBeLessThanOrEqual(31);
  }, 60000);
});
