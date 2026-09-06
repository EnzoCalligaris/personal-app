import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDb } from "./db";
import { createAluno, createExercicio, createPersonal } from "./factories";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Personal Trainer e Aluno", () => {
  it("cria um Personal com perfil e um Aluno vinculado a ele", async () => {
    const { personalProfile } = await createPersonal({ name: "Carlos Personal" });
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id, name: "Ana Aluna" });

    const found = await prisma.personalProfile.findUniqueOrThrow({
      where: { id: personalProfile.id },
      include: { alunos: { include: { user: true } } },
    });

    expect(found.alunos).toHaveLength(1);
    expect(found.alunos[0].id).toBe(alunoProfile.id);
    expect(found.alunos[0].user.name).toBe("Ana Aluna");
  });

  it("isola os alunos por Personal (multi-tenant)", async () => {
    const { personalProfile: personalA } = await createPersonal({ name: "Personal A" });
    const { personalProfile: personalB } = await createPersonal({ name: "Personal B" });

    await createAluno({ personalId: personalA.id, name: "Aluno da A" });
    await createAluno({ personalId: personalB.id, name: "Aluno da B" });
    await createAluno({ personalId: personalB.id, name: "Aluno 2 da B" });

    const alunosDoA = await prisma.alunoProfile.findMany({ where: { personalId: personalA.id } });
    const alunosDoB = await prisma.alunoProfile.findMany({ where: { personalId: personalB.id } });

    expect(alunosDoA).toHaveLength(1);
    expect(alunosDoB).toHaveLength(2);
  });

  it("permite aluno sem personal vinculado (ainda não atribuído)", async () => {
    const { alunoProfile } = await createAluno({ personalId: null });
    expect(alunoProfile.personalId).toBeNull();
  });
});

describe("Exercícios e Treinos", () => {
  it("cria um treino com os exercícios na ordem definida", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });
    const supino = await createExercicio(personalProfile.id, { nome: "Supino reto" });
    const agachamento = await createExercicio(personalProfile.id, { nome: "Agachamento livre" });

    const treino = await prisma.treino.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        nome: "Treino A - Superior",
        exercicios: {
          create: [
            { exercicioId: supino.id, ordem: 1, series: 4, repeticoes: "8-10", carga: "40kg" },
            { exercicioId: agachamento.id, ordem: 2, series: 3, repeticoes: "12", carga: "peso corporal" },
          ],
        },
      },
      include: { exercicios: { orderBy: { ordem: "asc" }, include: { exercicio: true } } },
    });

    expect(treino.exercicios).toHaveLength(2);
    expect(treino.exercicios[0].exercicio.nome).toBe("Supino reto");
    expect(treino.exercicios[1].ordem).toBe(2);
  });

  it("impede duas entradas de treino_exercicio com a mesma ordem no mesmo treino", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });
    const exercicio = await createExercicio(personalProfile.id);

    const treino = await prisma.treino.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        nome: "Treino B",
      },
    });

    await prisma.treinoExercicio.create({
      data: { treinoId: treino.id, exercicioId: exercicio.id, ordem: 1, series: 3, repeticoes: "10" },
    });

    await expect(
      prisma.treinoExercicio.create({
        data: { treinoId: treino.id, exercicioId: exercicio.id, ordem: 1, series: 3, repeticoes: "10" },
      })
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("registra o histórico de execução de um treino", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });
    const treino = await prisma.treino.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        nome: "Treino C",
      },
    });

    await prisma.historicoTreino.create({
      data: {
        treinoId: treino.id,
        treinoNome: treino.nome,
        alunoId: alunoProfile.id,
        concluido: true,
      },
    });

    const historico = await prisma.historicoTreino.findMany({ where: { alunoId: alunoProfile.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0].concluido).toBe(true);
  });
});

describe("Agenda (Disponibilidade e Agendamento)", () => {
  it("cria disponibilidade do personal e um agendamento do aluno nesse horário", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });

    await prisma.disponibilidade.create({
      data: { personalId: personalProfile.id, diaSemana: "TERCA", horaInicio: "08:00", horaFim: "18:00" },
    });

    const agendamento = await prisma.agendamento.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        data: new Date("2026-09-08T11:00:00Z"),
        horaInicio: "11:00",
        horaFim: "12:00",
      },
    });

    expect(agendamento.status).toBe("AGENDADO");
  });

  it("impede disponibilidades duplicadas para o mesmo personal/dia/horário", async () => {
    const { personalProfile } = await createPersonal();

    await prisma.disponibilidade.create({
      data: { personalId: personalProfile.id, diaSemana: "QUINTA", horaInicio: "09:00", horaFim: "10:00" },
    });

    await expect(
      prisma.disponibilidade.create({
        data: { personalId: personalProfile.id, diaSemana: "QUINTA", horaInicio: "09:00", horaFim: "10:00" },
      })
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("permite cancelar e reagendar um agendamento", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });

    const agendamento = await prisma.agendamento.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        data: new Date("2026-09-09T13:00:00Z"),
        horaInicio: "13:00",
        horaFim: "14:00",
      },
    });

    const cancelado = await prisma.agendamento.update({
      where: { id: agendamento.id },
      data: { status: "CANCELADO" },
    });
    expect(cancelado.status).toBe("CANCELADO");

    const reagendado = await prisma.agendamento.update({
      where: { id: agendamento.id },
      data: { status: "REAGENDADO", data: new Date("2026-09-10T13:00:00Z") },
    });
    expect(reagendado.status).toBe("REAGENDADO");
  });
});

describe("Avaliação de bioimpedância e Feedback", () => {
  it("registra uma avaliação e um feedback do personal vinculado a ela", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });

    const avaliacao = await prisma.avaliacao.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        peso: 78.5,
        percentualGordura: 18.2,
        medidas: { cintura: 82, quadril: 98 },
      },
    });

    const feedback = await prisma.feedback.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        avaliacaoId: avaliacao.id,
        texto: "Boa evolução na composição corporal, seguir com o plano atual.",
      },
    });

    expect(feedback.avaliacaoId).toBe(avaliacao.id);

    const historicoDoAluno = await prisma.avaliacao.findMany({
      where: { alunoId: alunoProfile.id },
      orderBy: { data: "asc" },
    });
    expect(historicoDoAluno).toHaveLength(1);
  });
});

describe("Notificações", () => {
  it("cria uma notificação não lida para o usuário", async () => {
    const { user } = await createPersonal();

    const notificacao = await prisma.notificacao.create({
      data: {
        userId: user.id,
        tipo: "NOVA_AVALIACAO",
        titulo: "Nova avaliação registrada",
        mensagem: "Sua avaliação de bioimpedância foi registrada.",
      },
    });

    expect(notificacao.lida).toBe(false);
  });
});

describe("Integridade referencial", () => {
  it("ao excluir o Personal, o Aluno permanece (sem personal) mas os registros do Personal somem", async () => {
    const { personalProfile } = await createPersonal();
    const { alunoProfile } = await createAluno({ personalId: personalProfile.id });

    const treino = await prisma.treino.create({
      data: {
        personalId: personalProfile.id,
        alunoId: alunoProfile.id,
        nome: "Treino D",
      },
    });

    await prisma.personalProfile.delete({ where: { id: personalProfile.id } });

    const alunoAposExclusao = await prisma.alunoProfile.findUniqueOrThrow({
      where: { id: alunoProfile.id },
    });
    expect(alunoAposExclusao.personalId).toBeNull();

    const treinoAposExclusao = await prisma.treino.findUnique({ where: { id: treino.id } });
    expect(treinoAposExclusao).toBeNull();
  });

  it("ao excluir o usuário do aluno, o perfil de aluno é removido em cascata", async () => {
    const { user, alunoProfile } = await createAluno();

    await prisma.user.delete({ where: { id: user.id } });

    const alunoAposExclusao = await prisma.alunoProfile.findUnique({ where: { id: alunoProfile.id } });
    expect(alunoAposExclusao).toBeNull();
  });
});
