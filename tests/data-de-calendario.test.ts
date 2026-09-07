import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataDeCalendario, dataUTC } from "@/lib/date-utils";
import { hojeISO } from "@/lib/fuso";
import {
  agendarComoAluno,
  editarComoAluno,
  horariosParaAgendar,
} from "@/lib/aluno/agendamento";
import { resetDb } from "./db";
import { createAgendamento, createAluno, createPersonal } from "./factories";

/**
 * "Quarta-feira, dia 16" é uma data de calendário, não um instante.
 *
 * `agendamentos.data` é uma coluna DATE: guarda o dia em que o atendimento
 * acontece, e nada sobre o relógio. Quem escrevia lá meia-noite *local* gravava
 * o dia certo só por sorte - num servidor em Tóquio, a meia-noite do dia 16 já
 * é o dia 15 em UTC, que é como o Postgres lê a coluna. O mesmo vale para a
 * consulta de conflito: comparar a coluna com um intervalo de instantes locais
 * varria o dia vizinho.
 *
 * Aqui o relógio é fixo e o fuso do processo varia de propósito: o dia
 * escolhido tem de atravessar gravação, consulta e leitura sem escorregar.
 */

/** Onde o servidor pode estar: a resposta não pode depender disso. */
const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo"];

const QUARTA = "2026-09-16";
const QUINTA = "2026-09-17";
/** Meio-dia de São Paulo, dez dias antes: dentro da janela e da antecedência. */
const AGORA = new Date("2026-09-06T15:00:00Z");

let personalId: string;

/** Roda o corpo uma vez por fuso de processo, devolvendo o original no fim. */
async function emCadaFuso(corpo: (fuso: string) => Promise<void>) {
  const original = process.env.TZ;
  try {
    for (const fuso of FUSOS) {
      process.env.TZ = fuso;
      await corpo(fuso);
    }
  } finally {
    process.env.TZ = original;
  }
}

/** Um aluno novo do mesmo Personal, para cada cenário começar do zero. */
async function alunoNovo(nome: string) {
  const aluno = await createAluno({ name: nome, personalId });
  return aluno.alunoProfile.id;
}

/** Limpa a agenda do Personal entre as repetições. */
async function agendaVazia() {
  await prisma.agendamento.deleteMany({ where: { personalId } });
}

beforeAll(async () => {
  await resetDb();
  const personal = await createPersonal({ name: "Personal do Calendario" });
  personalId = personal.personalProfile.id;

  // Atende quarta e quinta, das 08h às 12h, em atendimentos de uma hora.
  await prisma.disponibilidade.createMany({
    data: [
      { personalId, diaSemana: "QUARTA", horaInicio: "08:00", horaFim: "12:00", duracaoMin: 60 },
      { personalId, diaSemana: "QUINTA", horaInicio: "08:00", horaFim: "12:00", duracaoMin: 60 },
    ],
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("O dia de um agendamento é um dia de calendário", () => {
  it("a coluna guarda o dia pedido em qualquer fuso do processo", async () => {
    await emCadaFuso(async (fuso) => {
      await agendaVazia();
      const alunoId = await alunoNovo(`Coluna ${fuso}`);

      const criado = await createAgendamento(personalId, alunoId, {
        data: dataUTC(QUARTA),
        horaInicio: "08:00",
        horaFim: "09:00",
      });

      const lido = await prisma.agendamento.findUniqueOrThrow({ where: { id: criado.id } });
      expect(lido.data.toISOString(), `gravado com TZ=${fuso}`).toBe("2026-09-16T00:00:00.000Z");
      expect(dataDeCalendario(lido.data), `lido com TZ=${fuso}`).toBe(QUARTA);
    });
  }, 120000);

  it("o aluno marca no dia 16 e o banco guarda o dia 16", async () => {
    await emCadaFuso(async (fuso) => {
      await agendaVazia();
      const alunoId = await alunoNovo(`Marcou ${fuso}`);

      const marcado = await agendarComoAluno(
        alunoId,
        { data: QUARTA, horaInicio: "10:00", horaFim: "11:00" },
        AGORA
      );

      expect(marcado.data, `resposta com TZ=${fuso}`).toBe(QUARTA);

      const linha = await prisma.agendamento.findUniqueOrThrow({ where: { id: marcado.id } });
      expect(linha.data.toISOString(), `coluna com TZ=${fuso}`).toBe("2026-09-16T00:00:00.000Z");
    });
  }, 120000);

  it("o reagendamento move para o dia 17 sem escorregar", async () => {
    await emCadaFuso(async (fuso) => {
      await agendaVazia();
      const alunoId = await alunoNovo(`Remarcou ${fuso}`);

      const marcado = await agendarComoAluno(
        alunoId,
        { data: QUARTA, horaInicio: "08:00", horaFim: "09:00" },
        AGORA
      );
      const remarcado = await editarComoAluno(
        alunoId,
        marcado.id,
        { data: QUINTA, horaInicio: "08:00", horaFim: "09:00" },
        AGORA
      );

      expect(remarcado.data, `resposta com TZ=${fuso}`).toBe(QUINTA);

      const linha = await prisma.agendamento.findUniqueOrThrow({ where: { id: marcado.id } });
      expect(linha.data.toISOString(), `coluna com TZ=${fuso}`).toBe("2026-09-17T00:00:00.000Z");
    });
  }, 120000);

  it("o horário ocupado só bloqueia o próprio dia", async () => {
    await emCadaFuso(async (fuso) => {
      await agendaVazia();
      const ocupante = await alunoNovo(`Ocupante ${fuso}`);
      const candidato = await alunoNovo(`Candidato ${fuso}`);

      await createAgendamento(personalId, ocupante, {
        data: dataUTC(QUARTA),
        horaInicio: "09:00",
        horaFim: "10:00",
        status: "CONFIRMADO",
      });

      // Mesmo horário, mesmo dia: o conflito é real.
      await expect(
        agendarComoAluno(
          candidato,
          { data: QUARTA, horaInicio: "09:00", horaFim: "10:00" },
          AGORA
        ),
        `conflito no próprio dia, TZ=${fuso}`
      ).rejects.toThrow(/preenchido/i);

      // Mesmo horário, dia seguinte: nada a ver com o da quarta.
      const naQuinta = await agendarComoAluno(
        candidato,
        { data: QUINTA, horaInicio: "09:00", horaFim: "10:00" },
        AGORA
      );
      expect(naQuinta.data, `dia vizinho livre, TZ=${fuso}`).toBe(QUINTA);
    });
  }, 120000);

  it("a lista de horários livres não enxerga o dia vizinho", async () => {
    await emCadaFuso(async (fuso) => {
      await agendaVazia();
      const ocupante = await alunoNovo(`Vizinho ${fuso}`);
      const olhando = await alunoNovo(`Olhando ${fuso}`);

      await createAgendamento(personalId, ocupante, {
        data: dataUTC(QUINTA),
        horaInicio: "09:00",
        horaFim: "10:00",
        status: "CONFIRMADO",
      });

      const naQuarta = await horariosParaAgendar(olhando, QUARTA, AGORA);
      const naQuinta = await horariosParaAgendar(olhando, QUINTA, AGORA);

      expect(naQuarta.livres.map((slot) => slot.horaInicio), `TZ=${fuso}`).toContain("09:00");
      expect(naQuinta.livres.map((slot) => slot.horaInicio), `TZ=${fuso}`).not.toContain("09:00");
    });
  }, 120000);
});

describe("O dia oficial vem do fuso da aplicação", () => {
  /**
   * O `hojeISO` da tela de programação semanal lia o relógio do navegador: à
   * meia-noite e meia de Tóquio o Personal já via o dia seguinte, e a semana
   * começava um dia adiantada.
   */
  it("um instante depois das 21h ainda é o dia brasileiro", () => {
    expect(hojeISO(new Date("2026-09-07T00:51:00Z"))).toBe("2026-09-06");
    expect(hojeISO(new Date("2026-09-06T02:59:59Z"))).toBe("2026-09-05");
    expect(hojeISO(new Date("2026-09-06T03:00:00Z"))).toBe("2026-09-06");
  });

  it("e o resultado não muda com o fuso de quem abre a tela", () => {
    const original = process.env.TZ;
    try {
      for (const fuso of FUSOS) {
        process.env.TZ = fuso;
        expect(hojeISO(new Date("2026-09-07T00:51:00Z")), `TZ=${fuso}`).toBe("2026-09-06");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
