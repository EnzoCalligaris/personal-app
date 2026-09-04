import "dotenv/config";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";

// Client admin construído localmente (em vez de importar src/lib/supabase/admin.ts,
// que usa `server-only` e não pode ser carregado fora do bundler do Next.js).
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SENHA_PADRAO = "Teste@12345";

type SeedUser = {
  email: string;
  name: string;
  role: "PERSONAL" | "ALUNO";
  /** e-mail do Personal ao qual este aluno deve ficar vinculado */
  personalEmail?: string;
};

const USERS: SeedUser[] = [
  { email: "personal1@teste.com", name: "Carlos Personal", role: "PERSONAL" },
  { email: "personal2@teste.com", name: "Marina Personal", role: "PERSONAL" },
  { email: "aluno1@teste.com", name: "Ana Aluna", role: "ALUNO", personalEmail: "personal1@teste.com" },
  { email: "aluno2@teste.com", name: "Bruno Aluno", role: "ALUNO", personalEmail: "personal1@teste.com" },
  { email: "aluno3@teste.com", name: "Carla Aluna", role: "ALUNO", personalEmail: "personal2@teste.com" },
];

type AdminClient = ReturnType<typeof createAdminClient>;

/** Procura um usuário do Auth pelo e-mail (a API admin lista por página). */
async function findAuthUserIdByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao listar usuários do Auth: ${error.message}`);

    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  const admin = createAdminClient();
  const personalIdByEmail = new Map<string, string>();

  for (const seedUser of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: seedUser.email } });

    let userId: string;

    if (existing) {
      console.log(`- já existe: ${seedUser.email}`);
      userId = existing.id;
    } else {
      // Pode existir no Auth mesmo sem linha em public.users (ex.: o banco da
      // aplicação foi limpo). Nesse caso reaproveitamos a conta do Auth.
      userId = (await findAuthUserIdByEmail(admin, seedUser.email)) ?? "";

      if (userId) {
        await admin.auth.admin.updateUserById(userId, {
          password: SENHA_PADRAO,
          app_metadata: { role: seedUser.role },
          user_metadata: { name: seedUser.name },
        });
        console.log(`~ reaproveitado do Auth: ${seedUser.email}`);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: seedUser.email,
          password: SENHA_PADRAO,
          email_confirm: true,
          app_metadata: { role: seedUser.role },
          user_metadata: { name: seedUser.name },
        });

        if (error || !data.user) {
          throw new Error(`Falha ao criar ${seedUser.email} no Auth: ${error?.message}`);
        }

        userId = data.user.id;
        console.log(`+ criado: ${seedUser.email} (${seedUser.role})`);
      }

      await prisma.user.create({
        data: { id: userId, email: seedUser.email, name: seedUser.name, role: seedUser.role },
      });
    }

    // Garante o perfil correspondente (idempotente).
    if (seedUser.role === "PERSONAL") {
      const profile = await prisma.personalProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      personalIdByEmail.set(seedUser.email, profile.id);
    } else {
      await prisma.alunoProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    }
  }

  // Vincula os alunos aos respectivos personals (idempotente).
  for (const seedUser of USERS) {
    if (seedUser.role !== "ALUNO" || !seedUser.personalEmail) continue;

    const user = await prisma.user.findUniqueOrThrow({ where: { email: seedUser.email } });
    const personalId = personalIdByEmail.get(seedUser.personalEmail);
    if (!personalId) continue;

    await prisma.alunoProfile.update({
      where: { userId: user.id },
      data: { personalId },
    });
  }

  await seedDadosDemo();

  console.log("\nUsuários de teste (senha para todos):", SENHA_PADRAO);
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(8)} ${u.email}${u.personalEmail ? `  (personal: ${u.personalEmail})` : ""}`);
  }
}

const DIAS_SEMANA = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

function emDias(dias: number, hora = 12) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/**
 * Dados de demonstração para o ambiente de desenvolvimento: exercícios,
 * treinos, agendamentos, execuções e avaliações, para o dashboard ter
 * conteúdo real. Idempotente - não recria se o Personal já tiver exercícios.
 */
async function seedDadosDemo() {
  const personal = await prisma.personalProfile.findFirst({
    where: { user: { email: "personal1@teste.com" } },
    include: { alunos: { include: { user: { select: { email: true } } } } },
  });

  if (!personal) return;

  const jaTemDados = await prisma.exercicio.count({ where: { personalId: personal.id } });
  if (jaTemDados > 0) {
    console.log("\n- dados de demonstração já existem (pulando)");
    return;
  }

  const ana = personal.alunos.find((a) => a.user.email === "aluno1@teste.com");
  const bruno = personal.alunos.find((a) => a.user.email === "aluno2@teste.com");
  if (!ana || !bruno) return;

  const hoje = DIAS_SEMANA[new Date().getDay()];
  const amanha = DIAS_SEMANA[emDias(1).getDay()];

  const exercicios = await Promise.all(
    [
      { nome: "Supino reto", grupoMuscular: "Peito" },
      { nome: "Agachamento livre", grupoMuscular: "Pernas" },
      { nome: "Remada curvada", grupoMuscular: "Costas" },
      { nome: "Desenvolvimento militar", grupoMuscular: "Ombros" },
    ].map((exercicio) => prisma.exercicio.create({ data: { ...exercicio, personalId: personal.id } }))
  );

  // Treinos: um para hoje (aparece em "treinos de hoje") e um para amanhã.
  await prisma.treino.create({
    data: {
      personalId: personal.id,
      alunoId: ana.id,
      nome: "Treino A · Superior",
      diaSemana: hoje,
      exercicios: {
        create: [
          { exercicioId: exercicios[0].id, ordem: 1, series: 4, repeticoes: "8-10", carga: "40kg" },
          { exercicioId: exercicios[2].id, ordem: 2, series: 4, repeticoes: "10-12", carga: "35kg" },
          { exercicioId: exercicios[3].id, ordem: 3, series: 3, repeticoes: "12", carga: "15kg" },
        ],
      },
    },
  });

  await prisma.treino.create({
    data: {
      personalId: personal.id,
      alunoId: ana.id,
      nome: "Treino B · Inferior",
      diaSemana: amanha,
      exercicios: {
        create: [
          { exercicioId: exercicios[1].id, ordem: 1, series: 4, repeticoes: "10", carga: "60kg" },
        ],
      },
    },
  });

  const treinoBruno = await prisma.treino.create({
    data: {
      personalId: personal.id,
      alunoId: bruno.id,
      nome: "Full body",
      diaSemana: hoje,
      exercicios: {
        create: [
          { exercicioId: exercicios[1].id, ordem: 1, series: 3, repeticoes: "12", carga: "50kg" },
          { exercicioId: exercicios[0].id, ordem: 2, series: 3, repeticoes: "10", carga: "45kg" },
        ],
      },
    },
  });

  await prisma.agendamento.createMany({
    data: [
      {
        personalId: personal.id,
        alunoId: ana.id,
        data: emDias(0, 8),
        horaInicio: "08:00",
        horaFim: "09:00",
        status: "AGENDADO",
      },
      {
        personalId: personal.id,
        alunoId: bruno.id,
        data: emDias(0, 18),
        horaInicio: "18:00",
        horaFim: "19:00",
        status: "REAGENDADO",
      },
      {
        personalId: personal.id,
        alunoId: ana.id,
        data: emDias(1, 8),
        horaInicio: "08:00",
        horaFim: "09:00",
        status: "AGENDADO",
      },
      {
        personalId: personal.id,
        alunoId: bruno.id,
        data: emDias(3, 18),
        horaInicio: "18:00",
        horaFim: "19:00",
        status: "AGENDADO",
      },
    ],
  });

  await prisma.historicoTreino.create({
    data: { treinoId: treinoBruno.id, alunoId: bruno.id, dataExecucao: emDias(-2), concluido: true },
  });

  await prisma.avaliacao.createMany({
    data: [
      {
        personalId: personal.id,
        alunoId: ana.id,
        data: emDias(-3),
        peso: 62.4,
        percentualGordura: 24.1,
        massaMagra: 47.4,
        imc: 22.1,
      },
      {
        personalId: personal.id,
        alunoId: bruno.id,
        data: emDias(-12),
        peso: 81.2,
        percentualGordura: 18.5,
        massaMagra: 66.2,
        imc: 25.4,
      },
    ],
  });

  console.log("\n+ dados de demonstração criados (exercícios, treinos, agenda e avaliações)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
