import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  atualizarAgendamento,
  ConflitoDeHorarioError,
  criarAgendamento,
  criarBloqueio,
  HorarioBloqueadoError,
} from "@/lib/agenda/queries";
import {
  agendarComoAluno,
  editarComoAluno,
  horariosParaAgendar,
} from "@/lib/aluno/agendamento";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";

/**
 * A regra de ocupação da agenda é uma só, vista de dois lugares.
 *
 * O Personal marcando na própria agenda e o aluno marcando na agenda dele
 * chegam ao mesmo lugar por caminhos diferentes - e cada um traduz a recusa
 * para o próprio vocabulário. O que estes testes garantem é que a *decisão* é
 * idêntica: o horário que o Personal considera ocupado é exatamente o que o
 * aluno não consegue marcar.
 *
 * Enquanto as duas cópias da regra existiram lado a lado, elas divergiram sem
 * ninguém notar. Aqui os dois fluxos respondem sobre o mesmo cenário.
 */

/** Uma quarta-feira qualquer, dez dias à frente do relógio fixo abaixo. */
const QUARTA = "2026-09-16";
/** Meio-dia em São Paulo: dentro da janela e da antecedência para o aluno. */
const AGORA = new Date("2026-09-06T15:00:00Z");

let personalId: string;
let ana: string;
let bruno: string;

/** Limpa a agenda entre cenários, mantendo o expediente. */
async function agendaVazia() {
  await prisma.agendamento.deleteMany({ where: { personalId } });
  await prisma.bloqueio.deleteMany({ where: { personalId } });
}

/** O Personal marca direto na agenda dele. */
function personalMarca(alunoId: string, horaInicio: string, horaFim: string) {
  return criarAgendamento(personalId, {
    alunoId,
    data: QUARTA,
    horaInicio,
    horaFim,
    status: "CONFIRMADO",
  });
}

/** O aluno marca pela área dele, com o relógio fixo. */
function alunoMarca(alunoId: string, horaInicio: string, horaFim: string) {
  return agendarComoAluno(alunoId, { data: QUARTA, horaInicio, horaFim }, AGORA);
}

beforeAll(async () => {
  await resetDb();
  const personal = await createPersonal({ name: "Personal do Conflito" });
  personalId = personal.personalProfile.id;

  const umaAluna = await createAluno({ name: "Ana Conflito", personalId });
  const umAluno = await createAluno({ name: "Bruno Conflito", personalId });
  ana = umaAluna.alunoProfile.id;
  bruno = umAluno.alunoProfile.id;

  // Atende quarta das 08h às 12h, em atendimentos de uma hora.
  await prisma.disponibilidade.create({
    data: {
      personalId,
      diaSemana: "QUARTA",
      horaInicio: "08:00",
      horaFim: "12:00",
      duracaoMin: 60,
    },
  });
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Horário livre", () => {
  it("os dois lados marcam quando não há nada no caminho", async () => {
    await agendaVazia();

    const doPersonal = await personalMarca(ana, "08:00", "09:00");
    expect(doPersonal.horaInicio).toBe("08:00");

    const doAluno = await alunoMarca(bruno, "10:00", "11:00");
    expect(doAluno.horaInicio).toBe("10:00");
  });
});

describe("Conflito com outro atendimento", () => {
  it("recusa dos dois lados, cada um com o seu erro", async () => {
    await agendaVazia();
    await personalMarca(ana, "09:00", "10:00");

    await expect(personalMarca(bruno, "09:00", "10:00")).rejects.toBeInstanceOf(
      ConflitoDeHorarioError
    );
    await expect(alunoMarca(bruno, "09:00", "10:00")).rejects.toThrow(/preenchido/i);
  });

  it("um atendimento cancelado não segura mais o horário", async () => {
    await agendaVazia();
    const marcado = await personalMarca(ana, "09:00", "10:00");
    await atualizarAgendamento(personalId, marcado.id, { status: "CANCELADO" });

    const doOutro = await personalMarca(bruno, "09:00", "10:00");
    expect(doOutro.id).not.toBe(marcado.id);
  });
});

describe("Conflito com bloqueio", () => {
  it("recusa dos dois lados quando o Personal bloqueou a faixa", async () => {
    await agendaVazia();
    await criarBloqueio(personalId, {
      data: QUARTA,
      horaInicio: "09:00",
      horaFim: "10:00",
      motivo: "Compromisso",
    });

    await expect(personalMarca(ana, "09:00", "10:00")).rejects.toBeInstanceOf(
      HorarioBloqueadoError
    );
    await expect(alunoMarca(ana, "09:00", "10:00")).rejects.toThrow(/bloqueado/i);

    // Fora da faixa bloqueada, segue livre.
    const fora = await personalMarca(ana, "11:00", "12:00");
    expect(fora.horaInicio).toBe("11:00");
  });

  it("bloqueio sem horário fecha o dia inteiro para os dois", async () => {
    await agendaVazia();
    await criarBloqueio(personalId, { data: QUARTA, motivo: "Feriado" });

    await expect(personalMarca(ana, "08:00", "09:00")).rejects.toBeInstanceOf(
      HorarioBloqueadoError
    );
    await expect(alunoMarca(ana, "08:00", "09:00")).rejects.toThrow(/bloqueado/i);

    // E a tela do aluno nem chega a oferecer horários nesse dia.
    const horarios = await horariosParaAgendar(ana, QUARTA, AGORA);
    expect(horarios.motivo).toBe("BLOQUEADO");
    expect(horarios.livres).toEqual([]);
  });
});

describe("Sobreposição parcial", () => {
  /** O horário já ocupado é 09:00-10:00 em todos os casos. */
  const encostoes: [string, string, string][] = [
    ["começa antes e invade", "08:30", "09:30"],
    ["começa dentro e passa do fim", "09:30", "10:30"],
    ["cabe inteiro dentro", "09:15", "09:45"],
    ["engole o atendimento", "08:00", "11:00"],
  ];

  it("qualquer minuto em comum já é conflito, dos dois lados", async () => {
    for (const [caso, horaInicio, horaFim] of encostoes) {
      await agendaVazia();
      await personalMarca(ana, "09:00", "10:00");

      await expect(personalMarca(bruno, horaInicio, horaFim), caso).rejects.toBeInstanceOf(
        ConflitoDeHorarioError
      );
      await expect(alunoMarca(bruno, horaInicio, horaFim), caso).rejects.toThrow(/preenchido/i);
    }
  }, 60000);
});

describe("Horários adjacentes", () => {
  /** Os intervalos são [início, fim): encostar não é sobrepor. */
  it("encostar no fim ou no começo do vizinho não é conflito", async () => {
    await agendaVazia();
    await personalMarca(ana, "09:00", "10:00");

    const antes = await personalMarca(bruno, "08:00", "09:00");
    expect(antes.horaInicio).toBe("08:00");

    const depois = await alunoMarca(bruno, "10:00", "11:00");
    expect(depois.horaInicio).toBe("10:00");
  });

  it("o mesmo vale encostando num bloqueio", async () => {
    await agendaVazia();
    await criarBloqueio(personalId, { data: QUARTA, horaInicio: "09:00", horaFim: "10:00" });

    const antes = await personalMarca(ana, "08:00", "09:00");
    expect(antes.horaInicio).toBe("08:00");

    const depois = await alunoMarca(ana, "10:00", "11:00");
    expect(depois.horaInicio).toBe("10:00");
  });
});

describe("Edição não conflita com o próprio atendimento", () => {
  it("o Personal salva o mesmo horário sem acusar conflito", async () => {
    await agendaVazia();
    const marcado = await personalMarca(ana, "09:00", "10:00");

    const salvo = await atualizarAgendamento(personalId, marcado.id, {
      data: QUARTA,
      horaInicio: "09:00",
      horaFim: "10:00",
      observacoes: "Levar a ficha nova",
    });
    expect(salvo.horaInicio).toBe("09:00");

    // E consegue esticar por cima de si mesmo.
    const esticado = await atualizarAgendamento(personalId, marcado.id, {
      horaInicio: "09:00",
      horaFim: "11:00",
    });
    expect(esticado.horaFim).toBe("11:00");
  });

  it("o aluno remarca para um horário que encosta no próprio", async () => {
    await agendaVazia();
    const meu = await alunoMarca(ana, "09:00", "10:00");

    const remarcado = await editarComoAluno(
      ana,
      meu.id,
      { data: QUARTA, horaInicio: "09:30", horaFim: "10:30" },
      AGORA
    );
    expect(remarcado.horaInicio).toBe("09:30");
  });

  it("mas continua conflitando com o atendimento de outra pessoa", async () => {
    await agendaVazia();
    const meu = await alunoMarca(ana, "08:00", "09:00");
    await personalMarca(bruno, "10:00", "11:00");

    await expect(
      editarComoAluno(ana, meu.id, { data: QUARTA, horaInicio: "10:00", horaFim: "11:00" }, AGORA)
    ).rejects.toThrow(/preenchido/i);
  });
});

describe("Personal e aluno enxergam a mesma agenda", () => {
  it("o que o Personal marca some da lista de horários do aluno", async () => {
    await agendaVazia();

    const antes = await horariosParaAgendar(ana, QUARTA, AGORA);
    expect(antes.livres.map((slot) => slot.horaInicio)).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
    ]);

    await personalMarca(bruno, "09:00", "10:00");
    await criarBloqueio(personalId, { data: QUARTA, horaInicio: "11:00", horaFim: "12:00" });

    const depois = await horariosParaAgendar(ana, QUARTA, AGORA);
    expect(depois.livres.map((slot) => slot.horaInicio)).toEqual(["08:00", "10:00"]);

    // E o que sumiu da lista é exatamente o que a marcação recusa.
    await expect(alunoMarca(ana, "09:00", "10:00")).rejects.toThrow(/preenchido/i);
    await expect(alunoMarca(ana, "11:00", "12:00")).rejects.toThrow(/bloqueado/i);
  });
});
