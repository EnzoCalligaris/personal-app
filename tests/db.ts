import { prisma } from "@/lib/prisma";

// Ordem não importa: TRUNCATE ... CASCADE remove os dados de todas as
// tabelas dependentes junto. RESTART IDENTITY não se aplica aqui (ids são
// uuid), mas mantemos a limpeza total entre testes para isolamento.
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "notificacoes",
      "feedbacks",
      "avaliacoes",
      "agendamentos",
      "disponibilidades",
      "historico_treinos",
      "treino_exercicios",
      "treinos",
      "exercicios",
      "aluno_profiles",
      "personal_profiles",
      "users"
    CASCADE;
  `);

  // Os usuários de teste (factories.ts) também existem em auth.users
  // (necessário pela FK users.id -> auth.users.id). O TRUNCATE acima não
  // alcança esse schema, então limpamos aqui os que usam o domínio de teste.
  await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE email LIKE '%@example.com';`);
}
