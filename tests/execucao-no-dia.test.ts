import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC, paraISO } from "@/lib/date-utils";
import { dataDeCalendarioDe, limitesDoDia } from "@/lib/fuso";
import { treinoPrevistoEm } from "@/lib/programacoes/queries";
import { resetDb } from "./db";
import { createAluno, createPersonal, createTreino } from "./factories";

/**
 * "O aluno treinou hoje?" - e o dia é o do calendário brasileiro.
 *
 * O treino é gravado como instante (UTC, que é o padrão do sistema), mas
 * pertence ao dia em que a pessoa treinou. Depois das 21:00 em São Paulo o
 * instante já caiu no dia seguinte em UTC, e era aí que a resposta virava
 * "não treinou": o painel mostrava o dia como pendente, o calendário perdia a
 * marcação e a aderência contava a menos.
 *
 * Todas as datas aqui são fixas e o fuso é explícito: o resultado não muda com
 * o relógio de quem roda a suíte nem com o do servidor.
 */

/** Um domingo qualquer, escolhido para as contas ficarem legíveis. */
const DIA = "2026-09-06";
const DIA_SEGUINTE = "2026-09-07";

let personal: Awaited<ReturnType<typeof createPersonal>>;

/** Cria um aluno com um treino executado no instante pedido. */
async function alunoQueTreinouEm(nome: string, instante: Date) {
  const aluno = await createAluno({ name: nome, personalId: personal.personalProfile.id });
  const treino = await createTreino(personal.personalProfile.id, aluno.alunoProfile.id, {
    nome: `Ficha de ${nome}`,
  });

  await prisma.historicoTreino.create({
    data: {
      treinoId: treino.id,
      treinoNome: treino.nome,
      alunoId: aluno.alunoProfile.id,
      dataExecucao: instante,
      concluido: true,
    },
  });

  return aluno.alunoProfile.id;
}

beforeAll(async () => {
  await resetDb();
  personal = await createPersonal({ name: "Personal Noturno" });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Um treino pertence ao dia em que foi feito no Brasil", () => {
  /**
   * Cada caso: hora de parede em São Paulo, o instante UTC equivalente e o dia
   * a que a execução deve pertencer.
   */
  const casos: [string, string, string, string][] = [
    ["20:59", `${DIA}T20:59:00-03:00`, "2026-09-06T23:59:00.000Z", DIA],
    ["21:00", `${DIA}T21:00:00-03:00`, "2026-09-07T00:00:00.000Z", DIA],
    ["21:59", `${DIA}T21:59:00-03:00`, "2026-09-07T00:59:00.000Z", DIA],
    ["23:59", `${DIA}T23:59:00-03:00`, "2026-09-07T02:59:00.000Z", DIA],
    ["00:30 do dia seguinte", `${DIA_SEGUINTE}T00:30:00-03:00`, "2026-09-07T03:30:00.000Z", DIA_SEGUINTE],
  ];

  it("a conversão para UTC é a esperada em cada horário", () => {
    for (const [hora, brt, utc] of casos) {
      expect(new Date(brt).toISOString(), `${hora} em São Paulo`).toBe(utc);
    }
  });

  it("o dia de calendário do instante é o dia brasileiro", () => {
    for (const [hora, brt, , diaEsperado] of casos) {
      expect(dataDeCalendarioDe(new Date(brt)), `${hora} pertence a ${diaEsperado}`).toBe(
        diaEsperado
      );
    }
  });

  it("os limites do dia cobrem até as 23:59 de São Paulo", () => {
    const { de, ate } = limitesDoDia(DIA);

    expect(de.toISOString()).toBe("2026-09-06T03:00:00.000Z");
    expect(ate.toISOString()).toBe("2026-09-07T02:59:59.999Z");

    // Os quatro horários do próprio dia caem dentro; o do dia seguinte, fora.
    for (const [hora, brt, , diaEsperado] of casos) {
      const instante = new Date(brt);
      const dentro = instante >= de && instante <= ate;
      expect(dentro, `${hora} dentro do dia ${DIA}`).toBe(diaEsperado === DIA);
    }
  });

  it("a consulta reconhece a execução no dia certo, incluindo depois das 21:00", async () => {
    for (const [hora, brt, , diaEsperado] of casos) {
      const alunoId = await alunoQueTreinouEm(`Aluno ${hora}`, new Date(brt));

      const noDia = await treinoPrevistoEm(alunoId, dataUTC(DIA));
      const noSeguinte = await treinoPrevistoEm(alunoId, dataUTC(DIA_SEGUINTE));

      expect(noDia.executado, `treino das ${hora} contado em ${DIA}`).toBe(diaEsperado === DIA);
      expect(noSeguinte.executado, `treino das ${hora} contado em ${DIA_SEGUINTE}`).toBe(
        diaEsperado === DIA_SEGUINTE
      );
      // A data devolvida é sempre a consultada, não a do instante.
      expect(noDia.data).toBe(DIA);
    }
  }, 120000);

  it("o resultado não muda com o fuso do processo", async () => {
    const alunoId = await alunoQueTreinouEm("Aluno Fuso", new Date(`${DIA}T21:51:00-03:00`));
    const tzOriginal = process.env.TZ;

    try {
      for (const fuso of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
        process.env.TZ = fuso;
        const previsto = await treinoPrevistoEm(alunoId, dataUTC(DIA));
        expect(previsto.executado, `com TZ=${fuso}`).toBe(true);
        expect(paraISO(dataUTC(DIA))).toBe(DIA);
      }
    } finally {
      process.env.TZ = tzOriginal;
    }
  }, 60000);
});
