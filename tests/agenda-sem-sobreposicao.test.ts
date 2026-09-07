import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/date-utils";
import { ConflitoDeHorarioError, criarAgendamento } from "@/lib/agenda/queries";
import { agendarComoAluno, AgendamentoRecusadoError } from "@/lib/aluno/agendamento";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";

/**
 * A rede embaixo da regra de conflito.
 *
 * `tests/conflito-de-agenda.test.ts` cobre a regra como a aplicação a aplica:
 * consulta a agenda e recusa antes de gravar. Entre essa consulta e a gravação
 * cabe outra requisição inteira, e era por essa fresta que dois alunos
 * conseguiam o mesmo horário.
 *
 * O que se verifica aqui é diferente: que o estado inválido é **impossível de
 * gravar**, mesmo quando ninguém perguntou antes. Por isso boa parte destes
 * testes escreve direto pelo Prisma, passando por cima da verificação da
 * aplicação - se a proteção dependesse do código, eles passariam.
 */

/** Uma quarta-feira qualquer, dez dias à frente do relógio fixo abaixo. */
const QUARTA = "2026-09-16";
const QUINTA = "2026-09-17";
/** Meio-dia em São Paulo: dentro da janela e da antecedência para o aluno. */
const AGORA = new Date("2026-09-06T15:00:00Z");

let personalId: string;
let outroPersonalId: string;
let ana: string;
let bruno: string;
let doOutro: string;

/** Grava direto no banco, sem passar pela regra da aplicação. */
function gravaDireto(
  pid: string,
  alunoId: string,
  dia: string,
  horaInicio: string,
  horaFim: string,
  status: "AGENDADO" | "CONFIRMADO" | "REAGENDADO" | "CANCELADO" | "REALIZADO" = "CONFIRMADO"
) {
  return prisma.agendamento.create({
    data: { personalId: pid, alunoId, data: dataUTC(dia), horaInicio, horaFim, status },
  });
}

async function agendaVazia() {
  await prisma.agendamento.deleteMany({
    where: { personalId: { in: [personalId, outroPersonalId] } },
  });
}

beforeAll(async () => {
  await resetDb();

  const personal = await createPersonal({ name: "Personal da Constraint" });
  personalId = personal.personalProfile.id;
  const outro = await createPersonal({ name: "Outro Personal" });
  outroPersonalId = outro.personalProfile.id;

  ana = (await createAluno({ name: "Ana Constraint", personalId })).alunoProfile.id;
  bruno = (await createAluno({ name: "Bruno Constraint", personalId })).alunoProfile.id;
  doOutro = (
    await createAluno({ name: "Aluno do Outro", personalId: outroPersonalId })
  ).alunoProfile.id;

  // Expediente para os dois Personais, para o caminho do aluno funcionar.
  for (const pid of [personalId, outroPersonalId]) {
    await prisma.disponibilidade.createMany({
      data: [
        { personalId: pid, diaSemana: "QUARTA", horaInicio: "08:00", horaFim: "12:00", duracaoMin: 60 },
        { personalId: pid, diaSemana: "QUINTA", horaInicio: "08:00", horaFim: "12:00", duracaoMin: 60 },
      ],
    });
  }
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("O banco recusa sobreposição, mesmo sem passar pela aplicação", () => {
  /** Contra um atendimento ativo das 09:00 às 10:00. */
  const recusados: [string, string, string][] = [
    ["exatamente o mesmo horário", "09:00", "10:00"],
    ["invade pelo início", "08:30", "09:30"],
    ["invade pelo fim", "09:30", "10:30"],
    ["cabe inteiro dentro", "09:15", "09:45"],
    ["engole o atendimento", "08:00", "11:00"],
  ];

  it("recusa qualquer forma de sobreposição", async () => {
    for (const [caso, horaInicio, horaFim] of recusados) {
      await agendaVazia();
      await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");

      await expect(
        gravaDireto(personalId, bruno, QUARTA, horaInicio, horaFim),
        caso
      ).rejects.toThrow(/agendamentos_sem_sobreposicao/);
    }
  }, 60000);

  /** Os intervalos são [início, fim): encostar não é sobrepor. */
  const aceitos: [string, string, string][] = [
    ["encosta antes", "08:00", "09:00"],
    ["encosta depois", "10:00", "11:00"],
    ["bem antes", "08:00", "08:30"],
  ];

  it("aceita horários que apenas encostam", async () => {
    for (const [caso, horaInicio, horaFim] of aceitos) {
      await agendaVazia();
      await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");

      const criado = await gravaDireto(personalId, bruno, QUARTA, horaInicio, horaFim);
      expect(criado.horaInicio, caso).toBe(horaInicio);
    }
  }, 60000);

  it("um horário desmarcado ou já realizado não segura mais o lugar", async () => {
    await agendaVazia();

    // Três atendimentos no mesmo horário: dois inativos e um ativo.
    await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00", "CANCELADO");
    await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00", "REALIZADO");
    const ativo = await gravaDireto(personalId, bruno, QUARTA, "09:00", "10:00", "CONFIRMADO");
    expect(ativo.status).toBe("CONFIRMADO");

    // O quarto, ativo, já não cabe.
    await expect(gravaDireto(personalId, ana, QUARTA, "09:00", "10:00")).rejects.toThrow(
      /agendamentos_sem_sobreposicao/
    );

    // E cancelar o ativo libera o lugar de novo, sem apagar nada.
    await prisma.agendamento.update({ where: { id: ativo.id }, data: { status: "CANCELADO" } });
    const novo = await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");
    expect(novo.id).not.toBe(ativo.id);

    const noSlot = await prisma.agendamento.count({
      where: { personalId, data: dataUTC(QUARTA), horaInicio: "09:00" },
    });
    expect(noSlot, "as linhas anteriores continuam no banco").toBe(4);
  });

  it("a proteção é por Personal e por dia", async () => {
    await agendaVazia();
    await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");

    // Outro dia do mesmo Personal.
    const outroDia = await gravaDireto(personalId, bruno, QUINTA, "09:00", "10:00");
    expect(outroDia.horaInicio).toBe("09:00");

    // Mesmo horário, Personal diferente: agendas independentes.
    const outraAgenda = await gravaDireto(outroPersonalId, doOutro, QUARTA, "09:00", "10:00");
    expect(outraAgenda.horaInicio).toBe("09:00");
  });
});

describe("A edição também é protegida pelo banco", () => {
  it("mover um atendimento para cima de outro é recusado", async () => {
    await agendaVazia();
    const daAna = await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");
    await gravaDireto(personalId, bruno, QUARTA, "10:00", "11:00");

    // 09:00-10:00 -> 09:30-10:30 invade o do Bruno.
    await expect(
      prisma.agendamento.update({
        where: { id: daAna.id },
        data: { horaInicio: "09:30", horaFim: "10:30" },
      })
    ).rejects.toThrow(/agendamentos_sem_sobreposicao/);
  });

  it("editar sem sair do próprio horário continua funcionando", async () => {
    await agendaVazia();
    const daAna = await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00");

    const mesmo = await prisma.agendamento.update({
      where: { id: daAna.id },
      data: { observacoes: "Levar a ficha nova" },
    });
    expect(mesmo.horaInicio).toBe("09:00");

    // E esticar por cima de si mesmo não é conflito consigo.
    const esticado = await prisma.agendamento.update({
      where: { id: daAna.id },
      data: { horaFim: "11:00" },
    });
    expect(esticado.horaFim).toBe("11:00");
  });

  it("reativar um cancelado sobre um horário ocupado é recusado", async () => {
    await agendaVazia();
    const cancelado = await gravaDireto(personalId, ana, QUARTA, "09:00", "10:00", "CANCELADO");
    await gravaDireto(personalId, bruno, QUARTA, "09:00", "10:00", "CONFIRMADO");

    await expect(
      prisma.agendamento.update({ where: { id: cancelado.id }, data: { status: "CONFIRMADO" } })
    ).rejects.toThrow(/agendamentos_sem_sobreposicao/);
  });
});

describe("Concorrência real", () => {
  /**
   * Estas são gravações de verdade em paralelo: as promessas são disparadas
   * juntas e o pool do Prisma as leva em conexões diferentes, então elas
   * disputam a mesma linha no banco. Não é uma simulação com duas chamadas em
   * sequência - em sequência a verificação da aplicação já bastaria.
   */
  it("seis gravações simultâneas no mesmo horário: só uma entra", async () => {
    await agendaVazia();

    const tentativas = Array.from({ length: 6 }, () =>
      gravaDireto(personalId, ana, QUARTA, "09:00", "10:00")
    );
    const resultados = await Promise.allSettled(tentativas);

    const entraram = resultados.filter((r) => r.status === "fulfilled");
    expect(entraram, "exatamente uma gravação deveria vencer").toHaveLength(1);

    for (const r of resultados.filter((r) => r.status === "rejected")) {
      expect(String((r as PromiseRejectedResult).reason)).toMatch(
        /agendamentos_sem_sobreposicao/
      );
    }

    const ativos = await prisma.agendamento.count({
      where: {
        personalId,
        data: dataUTC(QUARTA),
        status: { in: ["AGENDADO", "CONFIRMADO", "REAGENDADO"] },
      },
    });
    expect(ativos).toBe(1);
  }, 60000);

  it("quatro alunos marcando o mesmo horário ao mesmo tempo: um consegue, os outros ouvem o motivo", async () => {
    await agendaVazia();

    const alunos: string[] = [];
    for (let i = 0; i < 4; i++) {
      const novo = await createAluno({ name: `Corrida ${i}`, personalId });
      alunos.push(novo.alunoProfile.id);
    }

    const resultados = await Promise.allSettled(
      alunos.map((alunoId) =>
        agendarComoAluno(alunoId, { data: QUARTA, horaInicio: "09:00", horaFim: "10:00" }, AGORA)
      )
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    // O que importa para quem perdeu: um erro de negócio, com explicação. É
    // essa classe que a rota traduz em 409 - nunca um 500 com SQL dentro.
    for (const r of resultados.filter((r) => r.status === "rejected")) {
      const erro = (r as PromiseRejectedResult).reason;
      expect(erro).toBeInstanceOf(AgendamentoRecusadoError);
      expect(String(erro.message)).toMatch(/preenchido/i);
      expect(String(erro.message)).not.toMatch(/sobreposicao|gist|constraint|SELECT|INSERT/i);
    }

    const ativos = await prisma.agendamento.count({
      where: {
        personalId,
        data: dataUTC(QUARTA),
        status: { in: ["AGENDADO", "CONFIRMADO", "REAGENDADO"] },
      },
    });
    expect(ativos).toBe(1);
  }, 120000);

  it("o Personal marcando em paralelo recebe o erro de conflito de sempre", async () => {
    await agendaVazia();

    const resultados = await Promise.allSettled(
      [ana, bruno, ana, bruno].map((alunoId) =>
        criarAgendamento(personalId, {
          alunoId,
          data: QUARTA,
          horaInicio: "09:00",
          horaFim: "10:00",
          status: "CONFIRMADO",
        })
      )
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    for (const r of resultados.filter((r) => r.status === "rejected")) {
      const erro = (r as PromiseRejectedResult).reason;
      expect(erro).toBeInstanceOf(ConflitoDeHorarioError);
      expect(String(erro.message)).not.toMatch(/sobreposicao|gist|constraint/i);
    }
  }, 60000);

  it("Personais diferentes não disputam entre si", async () => {
    await agendaVazia();

    const resultados = await Promise.allSettled([
      gravaDireto(personalId, ana, QUARTA, "09:00", "10:00"),
      gravaDireto(outroPersonalId, doOutro, QUARTA, "09:00", "10:00"),
    ]);

    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
  });
});

describe("Edição concorrente", () => {
  it("duas remarcações simultâneas para o mesmo horário: só uma entra", async () => {
    await agendaVazia();
    const um = await gravaDireto(personalId, ana, QUARTA, "08:00", "09:00");
    const dois = await gravaDireto(personalId, bruno, QUARTA, "11:00", "12:00");

    // Os dois tentam ir para 10:00-11:00 ao mesmo tempo.
    const resultados = await Promise.allSettled(
      [um.id, dois.id].map((id) =>
        prisma.agendamento.update({
          where: { id },
          data: { horaInicio: "10:00", horaFim: "11:00" },
        })
      )
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const noHorario = await prisma.agendamento.count({
      where: {
        personalId,
        data: dataUTC(QUARTA),
        horaInicio: "10:00",
        status: { in: ["AGENDADO", "CONFIRMADO", "REAGENDADO"] },
      },
    });
    expect(noHorario).toBe(1);
  }, 60000);
});
