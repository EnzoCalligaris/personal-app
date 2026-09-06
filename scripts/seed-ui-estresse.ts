import "dotenv/config";
import { garantirBancoLocal } from "./guard-seed";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

/**
 * Conta de teste com conteúdo extremo, para a revisão de interface: nomes
 * longos, texto sem espaço, muitos exercícios, números grandes. É onde o
 * layout costuma quebrar - e os dados de demonstração, arrumados e curtos,
 * não revelam.
 *
 * Uso: npm run ui:estresse          cria (idempotente)
 *      npm run ui:estresse -- limpar  remove
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SENHA = "Teste@12345";
const EMAIL_PERSONAL = "estresse-personal@example.com";
const EMAIL_ALUNO = "estresse-aluno@example.com";

const NOME_PERSONAL = "Maria Auxiliadora de Albuquerque Cavalcanti Wanderley";
const NOME_ALUNO = "Ana Carolina de Vasconcelos Montenegro do Nascimento Filha";

/** Sem espaço nenhum: o pior caso para `truncate` e quebra de linha. */
const PALAVRA_LONGA = "Supinoretocombarralivreinclinadoquarentaecincograus";

const EXERCICIOS = [
  { nome: PALAVRA_LONGA, grupo: "Peito" },
  { nome: "Desenvolvimento militar sentado com halteres e pegada neutra", grupo: "Ombros" },
  { nome: "Agachamento", grupo: "Pernas" },
  { nome: "Remada curvada com barra e pegada pronada aberta", grupo: "Costas" },
  { nome: "Tríceps testa", grupo: "Braços" },
  { nome: "Elevação lateral com halteres e tronco levemente inclinado", grupo: "Ombros" },
  { nome: "Leg press 45 graus com pés afastados na plataforma", grupo: "Pernas" },
  { nome: "Puxada frontal", grupo: "Costas" },
  { nome: "Rosca direta com barra W e pegada supinada fechada", grupo: "Braços" },
  { nome: "Cadeira extensora unilateral com pausa de dois segundos", grupo: "Pernas" },
  { nome: "Abdominal infra", grupo: "Core" },
  { nome: "Panturrilha em pé no smith com amplitude completa", grupo: "Pernas" },
];

const OBSERVACAO_LONGA =
  "Descer em três segundos, segurar um segundo embaixo e subir explodindo. " +
  "Se a barra travar no meio do movimento, reduza cinco quilos e mantenha a " +
  "cadência. Não deixe o cotovelo abrir mais que quarenta e cinco graus em " +
  "relação ao tronco, para poupar o ombro.";

async function idNoAuth(email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email === email)?.id;
}

async function criarConta(email: string, nome: string, role: "PERSONAL" | "ALUNO") {
  const existente = await idNoAuth(email);
  if (existente) return existente;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name: nome },
  });
  if (error || !data.user) throw new Error(`Falha ao criar ${email}: ${error?.message}`);
  return data.user.id;
}

async function limpar() {
  await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE email LIKE '%estresse-%@example.com';`);
  for (const email of [EMAIL_PERSONAL, EMAIL_ALUNO]) {
    const id = await idNoAuth(email);
    if (id) await admin.auth.admin.deleteUser(id);
  }
  console.log("Conta de estresse removida.");
}

async function criar() {
  await limpar();

  const personalUserId = await criarConta(EMAIL_PERSONAL, NOME_PERSONAL, "PERSONAL");
  const alunoUserId = await criarConta(EMAIL_ALUNO, NOME_ALUNO, "ALUNO");

  await prisma.user.create({
    data: { id: personalUserId, email: EMAIL_PERSONAL, name: NOME_PERSONAL, role: "PERSONAL" },
  });
  const personal = await prisma.personalProfile.create({
    data: { userId: personalUserId, cref: "000000-G/SP" },
  });

  await prisma.user.create({
    data: {
      id: alunoUserId,
      email: EMAIL_ALUNO,
      name: NOME_ALUNO,
      role: "ALUNO",
      phone: "(11) 98888-7777",
    },
  });
  const aluno = await prisma.alunoProfile.create({
    data: {
      userId: alunoUserId,
      personalId: personal.id,
      altura: 168,
      objetivo:
        "Hipertrofia com foco em membros inferiores, mantendo a mobilidade de ombro e sem perder condicionamento cardiovascular",
    },
  });

  const exercicios = [];
  for (const item of EXERCICIOS) {
    exercicios.push(
      await prisma.exercicio.create({
        data: { personalId: personal.id, nome: item.nome, grupoMuscular: item.grupo },
      })
    );
  }

  const treino = await prisma.treino.create({
    data: {
      personalId: personal.id,
      alunoId: aluno.id,
      nome: "Treino A · Superior completo com ênfase em peito e ombros",
      observacoes: OBSERVACAO_LONGA,
      exercicios: {
        create: exercicios.map((exercicio, indice) => ({
          exercicioId: exercicio.id,
          ordem: indice + 1,
          series: 4,
          repeticoes: "10-12",
          carga: "107,5kg",
          descansoSeg: 90,
          observacoes: indice === 0 ? OBSERVACAO_LONGA : null,
        })),
      },
    },
  });

  // Programação com o mesmo treino em vários dias.
  await prisma.programacao.create({
    data: {
      personalId: personal.id,
      alunoId: aluno.id,
      nome: "Programação de hipertrofia com divisão ABC em cinco dias por semana",
      dataInicio: new Date(),
      dias: {
        create: (["SEGUNDA", "QUARTA", "SEXTA"] as const).map((diaSemana) => ({
          diaSemana,
          treinoId: treino.id,
        })),
      },
    },
  });

  // Avaliações com números grandes e todos os campos preenchidos.
  for (let i = 0; i < 6; i++) {
    const data = new Date();
    data.setDate(data.getDate() - i * 30);
    await prisma.avaliacao.create({
      data: {
        personalId: personal.id,
        alunoId: aluno.id,
        data,
        peso: 138.7 - i * 2.4,
        imc: 41.2 - i * 0.7,
        percentualGordura: 38.6 - i * 1.1,
        massaGorda: 52.3 - i * 1.8,
        massaMuscular: 61.4 + i * 0.6,
        massaMagra: 86.4 + i * 0.5,
        massaOssea: 3.2,
        aguaPercentual: 48.9,
        aguaLitros: 42.7,
        gorduraVisceral: 17,
        metabolismoBasal: 1987,
        idadeMetabolica: 47,
        observacoes: OBSERVACAO_LONGA,
      },
    });
  }

  await prisma.feedback.create({
    data: {
      personalId: personal.id,
      alunoId: aluno.id,
      texto:
        "Parabéns pela consistência deste mês. " + OBSERVACAO_LONGA + " " + PALAVRA_LONGA,
    },
  });

  // Execuções, para alimentar histórico e gráficos.
  for (let i = 0; i < 8; i++) {
    const dataExecucao = new Date();
    dataExecucao.setDate(dataExecucao.getDate() - i * 3);
    await prisma.historicoTreino.create({
      data: {
        treinoId: treino.id,
        treinoNome: treino.nome,
        alunoId: aluno.id,
        dataExecucao,
        duracaoSeg: 4200 + i * 120,
        concluido: true,
        itens: {
          create: exercicios.slice(0, 6).map((exercicio, indice) => ({
            exercicioId: exercicio.id,
            ordem: indice + 1,
            nome: exercicio.nome,
            grupoMuscular: EXERCICIOS[indice].grupo,
            series: 4,
            repeticoes: "10-12",
            carga: `${107.5 - i * 2.5}kg`,
            concluido: true,
          })),
        },
      },
    });
  }

  // Agenda cheia: expediente longo e vários atendimentos no mesmo dia.
  const DIAS = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"] as const;
  await prisma.disponibilidade.createMany({
    data: DIAS.map((diaSemana) => ({
      personalId: personal.id,
      diaSemana,
      horaInicio: "06:00",
      horaFim: "22:00",
      duracaoMin: 60,
    })),
  });

  for (let dias = 0; dias <= 4; dias++) {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    data.setHours(0, 0, 0, 0);
    if (data.getDay() === 0 || data.getDay() === 6) continue;

    for (const hora of ["06:00", "07:00", "08:00", "09:00", "10:00"]) {
      await prisma.agendamento.create({
        data: {
          personalId: personal.id,
          alunoId: aluno.id,
          data,
          horaInicio: hora,
          horaFim: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
          status: dias === 0 ? "CONFIRMADO" : "AGENDADO",
          observacoes: OBSERVACAO_LONGA,
        },
      });
    }
  }

  console.log(`Conta de estresse criada:
  PERSONAL ${EMAIL_PERSONAL}
  ALUNO    ${EMAIL_ALUNO}
  senha    ${SENHA}`);
}

async function main() {
  garantirBancoLocal();

  if (process.argv.includes("limpar")) await limpar();
  else await criar();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
