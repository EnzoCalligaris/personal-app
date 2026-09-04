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

  console.log("\nUsuários de teste (senha para todos):", SENHA_PADRAO);
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(8)} ${u.email}${u.personalEmail ? `  (personal: ${u.personalEmail})` : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
