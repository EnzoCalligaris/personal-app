import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { listarAlunos, obterAluno } from "@/lib/alunos/queries";
import { listarTreinos, obterTreino } from "@/lib/treinos/queries";
import { listarExercicios } from "@/lib/exercicios/queries";
import { getDashboardData } from "@/lib/dashboard/queries";
import { listarAvaliacoes } from "@/lib/avaliacoes/queries";
import { listarFeedbacks } from "@/lib/feedbacks/queries";
import { agendaDoPeriodo, horariosLivres } from "@/lib/agenda/queries";
import { meuDashboard, meuHistorico, meusTreinos, minhaAgenda, minhaEvolucao } from "@/lib/aluno/queries";
import { meuProgresso } from "@/lib/aluno/progresso";
import { paraISO, hojeUTC, somarDiasUTC } from "@/lib/date-utils";
import { resetDb } from "./db";
import { createAluno, createAvaliacao, createExercicio, createExecucao, createFeedback, createPersonal, createTreino } from "./factories";

/**
 * Orçamento de consultas ao banco.
 *
 * A marca de um N+1 é o custo crescer com a quantidade de registros. Aqui
 * cada função de leitura roda contra um volume realista e o número de idas ao
 * banco é fixado num teto. Se alguém trocar um `include` por um laço, o teto
 * estoura e o teste aponta onde.
 *
 * Os tetos são folgados de propósito: o alvo é pegar crescimento com o
 * volume, não brigar por uma consulta a mais.
 */

const ALUNOS = Number(process.env.DESEMPENHO_ALUNOS ?? 20);

let personal: Awaited<ReturnType<typeof createPersonal>>;
const alunos: Awaited<ReturnType<typeof createAluno>>[] = [];
let treinoId = "";
let primeiroAlunoId = "";

/** Conta as consultas emitidas pelo Prisma durante `acao`. */
async function consultas(acao: () => Promise<unknown>) {
  const registradas: string[] = [];
  const ouvinte = (evento: { query: string }) => registradas.push(evento.query);

  // O client é criado com eventos ligados por `tests/setup.ts`.
  (prisma as unknown as { $on: (e: string, cb: typeof ouvinte) => void }).$on("query", ouvinte);
  await acao();
  // Sem `$off` na API do Prisma: o ouvinte cai junto com o processo do teste.
  await new Promise((resolve) => setTimeout(resolve, 60));

  return registradas;
}

/** Roda a ação e devolve quantas consultas ela custou, já imprimindo. */
async function orcamento(nome: string, acao: () => Promise<unknown>) {
  const registradas = await consultas(acao);
  const total = registradas.filter((q) => !/^\s*(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)/i.test(q)).length;
  console.log(`  ${String(total).padStart(3)} consultas  ${nome}`);
  return total;
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Desempenho" });

  const exercicios = [];
  for (let i = 0; i < 8; i++) {
    exercicios.push(
      await createExercicio(personal.personalProfile.id, { nome: `Exercício ${i + 1}` })
    );
  }

  for (let i = 0; i < ALUNOS; i++) {
    const aluno = await createAluno({
      name: `Aluno Desempenho ${i + 1}`,
      personalId: personal.personalProfile.id,
    });
    alunos.push(aluno);

    for (let t = 0; t < 2; t++) {
      const treino = await createTreino(personal.personalProfile.id, aluno.alunoProfile.id, {
        nome: `Treino ${t === 0 ? "A" : "B"} do aluno ${i + 1}`,
        exercicios: exercicios.slice(0, 5).map((exercicio, ordem) => ({
          exercicioId: exercicio.id,
          ordem: ordem + 1,
          series: 4,
          repeticoes: "10",
          carga: "40kg",
        })),
      });
      if (i === 0 && t === 0) treinoId = treino.id;

      // Histórico: alimenta "última execução" nas listagens e os gráficos.
      for (let e = 0; e < 3; e++) {
        const dataExecucao = new Date();
        dataExecucao.setDate(dataExecucao.getDate() - e * 3);
        await createExecucao(treino.id, aluno.alunoProfile.id, {
          dataExecucao,
          itens: exercicios.slice(0, 5).map((exercicio) => ({
            exercicioId: exercicio.id,
            nome: exercicio.nome,
            carga: `${40 + e * 2.5}kg`,
          })),
        });
      }
    }

    for (let a = 0; a < 3; a++) {
      const data = somarDiasUTC(hojeUTC(), -a * 30);
      await createAvaliacao(personal.personalProfile.id, aluno.alunoProfile.id, { data });
    }

    await createFeedback(personal.personalProfile.id, aluno.alunoProfile.id);

    // Um atendimento por aluno, sem dois no mesmo horário: o expediente tem
    // 12 vagas por dia, então a partir do 13º aluno o dia vira o seguinte.
    // Sobrepor aqui não mediria nada e o banco recusa.
    const vaga = i % 12;
    await prisma.agendamento.create({
      data: {
        personalId: personal.personalProfile.id,
        alunoId: aluno.alunoProfile.id,
        data: somarDiasUTC(hojeUTC(), Math.floor(i / 12)),
        horaInicio: `${String(6 + vaga).padStart(2, "0")}:00`,
        horaFim: `${String(7 + vaga).padStart(2, "0")}:00`,
        status: "CONFIRMADO",
      },
    });
  }

  primeiroAlunoId = alunos[0].alunoProfile.id;

  await prisma.disponibilidade.createMany({
    data: (["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const).map(
      (diaSemana) => ({
        personalId: personal.personalProfile.id,
        diaSemana,
        horaInicio: "06:00",
        horaFim: "20:00",
        duracaoMin: 60,
      })
    ),
  });
}, 180000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Detecção de N+1", () => {
  it("o custo das listagens não muda entre 2 e ${ALUNOS} alunos", async () => {
    // Um segundo Personal com dois alunos: se alguma listagem fizer uma
    // consulta por registro, o número aqui será menor que o do primeiro - e
    // essa diferença é exatamente o N+1.
    const pequeno = await createPersonal({ name: "Personal Pequeno" });
    for (let i = 0; i < 2; i++) {
      const aluno = await createAluno({
        name: `Aluno Pequeno ${i + 1}`,
        personalId: pequeno.personalProfile.id,
      });
      await createTreino(pequeno.personalProfile.id, aluno.alunoProfile.id, { nome: "Treino" });
      await createAvaliacao(pequeno.personalProfile.id, aluno.alunoProfile.id);
      await createFeedback(pequeno.personalProfile.id, aluno.alunoProfile.id);

      // Mesma FORMA de dados dos dois lados: sem um atendimento aqui, a
      // comparação mediria "vazio x cheio" (ramos que nem chegam a rodar) em
      // vez de crescimento com o volume.
      const data = hojeUTC();
      await prisma.agendamento.create({
        data: {
          personalId: pequeno.personalProfile.id,
          alunoId: aluno.alunoProfile.id,
          data,
          horaInicio: `${String(6 + i).padStart(2, "0")}:00`,
          horaFim: `${String(7 + i).padStart(2, "0")}:00`,
          status: "CONFIRMADO",
        },
      });
    }

    await prisma.disponibilidade.createMany({
      data: (["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const).map(
        (diaSemana) => ({
          personalId: pequeno.personalProfile.id,
          diaSemana,
          horaInicio: "06:00",
          horaFim: "20:00",
          duracaoMin: 60,
        })
      ),
    });

    const pares: [string, (id: string) => Promise<unknown>][] = [
      ["listarAlunos", (id) => listarAlunos(id, { status: "TODOS", ordenar: "recentes" })],
      ["listarTreinos", (id) => listarTreinos(id, { status: "TODOS" })],
      ["listarAvaliacoes", (id) => listarAvaliacoes(id, {})],
      ["listarFeedbacks", (id) => listarFeedbacks(id, {})],
      ["agendaDoPeriodo", (id) => agendaDoPeriodo(id, "semana", hojeUTC())],
      ["getDashboardData", (id) => getDashboardData(id)],
    ];

    for (const [nome, executar] of pares) {
      const comMuitos = (await consultas(() => executar(personal.personalProfile.id))).length;
      const comPoucos = (await consultas(() => executar(pequeno.personalProfile.id))).length;
      console.log(`  ${nome}: ${comPoucos} consultas com 2 alunos, ${comMuitos} com ${ALUNOS}`);
      expect(comMuitos, `${nome} cresce com o volume (N+1)`).toBe(comPoucos);
    }
  }, 120000);
});

describe(`Orçamento de consultas · ${ALUNOS} alunos, 2 treinos e 3 execuções cada`, () => {
  it("as telas do Personal não crescem com a quantidade de alunos", async () => {
    const lista = await orcamento("listarAlunos", () =>
      listarAlunos(personal.personalProfile.id, { status: "TODOS", ordenar: "recentes" })
    );
    const detalhe = await orcamento("obterAluno", () =>
      obterAluno(personal.personalProfile.id, primeiroAlunoId)
    );
    const treinos = await orcamento("listarTreinos", () =>
      listarTreinos(personal.personalProfile.id, { status: "TODOS" })
    );
    const treino = await orcamento("obterTreino", () =>
      obterTreino(personal.personalProfile.id, treinoId)
    );
    const exercicios = await orcamento("listarExercicios", () =>
      listarExercicios(personal.personalProfile.id, { status: "TODOS", ordenar: "recentes" })
    );
    const painel = await orcamento("getDashboardData", () =>
      getDashboardData(personal.personalProfile.id)
    );
    const avaliacoes = await orcamento("listarAvaliacoes", () =>
      listarAvaliacoes(personal.personalProfile.id, {})
    );
    const feedbacks = await orcamento("listarFeedbacks", () =>
      listarFeedbacks(personal.personalProfile.id, {})
    );

    // Tetos: constantes, não proporcionais a ALUNOS.
    expect(lista).toBeLessThanOrEqual(16);
    expect(detalhe).toBeLessThanOrEqual(15);
    expect(treinos).toBeLessThanOrEqual(14);
    expect(treino).toBeLessThanOrEqual(10);
    expect(exercicios).toBeLessThanOrEqual(8);
    expect(painel).toBeLessThanOrEqual(34);
    expect(avaliacoes).toBeLessThanOrEqual(10);
    expect(feedbacks).toBeLessThanOrEqual(15);
  });

  it("a agenda não cresce com a quantidade de atendimentos", async () => {
    const semana = await orcamento("agendaDoPeriodo(semana)", () =>
      agendaDoPeriodo(personal.personalProfile.id, "semana", hojeUTC())
    );
    const mes = await orcamento("agendaDoPeriodo(mes)", () =>
      agendaDoPeriodo(personal.personalProfile.id, "mes", hojeUTC())
    );
    const livres = await orcamento("horariosLivres", () =>
      horariosLivres(personal.personalProfile.id, paraISO(hojeUTC()))
    );

    expect(semana).toBeLessThanOrEqual(14);
    expect(mes).toBeLessThanOrEqual(14);
    expect(livres).toBeLessThanOrEqual(6);
  });

  it("as telas do aluno não crescem com o histórico", async () => {
    const painel = await orcamento("meuDashboard", () => meuDashboard(primeiroAlunoId));
    const treinos = await orcamento("meusTreinos", () => meusTreinos(primeiroAlunoId));
    const historico = await orcamento("meuHistorico", () => meuHistorico(primeiroAlunoId));
    const agenda = await orcamento("minhaAgenda", () => minhaAgenda(primeiroAlunoId));
    const evolucao = await orcamento("minhaEvolucao", () => minhaEvolucao(primeiroAlunoId));
    const progresso = await orcamento("meuProgresso", () => meuProgresso(primeiroAlunoId));

    expect(painel).toBeLessThanOrEqual(34);
    expect(treinos).toBeLessThanOrEqual(12);
    expect(historico).toBeLessThanOrEqual(9);
    expect(agenda).toBeLessThanOrEqual(9);
    expect(evolucao).toBeLessThanOrEqual(4);
    expect(progresso).toBeLessThanOrEqual(14);
  });
});
