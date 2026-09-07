import { prisma } from "@/lib/prisma";

/**
 * Limpa apenas os dados criados pelos testes.
 *
 * As factories criam usuários no domínio `@example.com`.
 *
 * Escopar assim (em vez de TRUNCATE nas tabelas) preserva os usuários de
 * desenvolvimento criados por `npm run db:seed` (domínio `@teste.com`), que
 * antes eram destruídos a cada execução da suíte.
 */
export async function resetDb() {
  // Apaga os dois lados: `public.users` (que cascateia para perfis, treinos,
  // agendamentos, avaliações...) e a conta correspondente no Supabase Auth.
  await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE email LIKE '%@example.com';`);
  await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE email LIKE '%@example.com';`);

  // O limite de tentativas das rotas de auth conta por IP, e a suíte inteira
  // sai do mesmo endereço: sem zerar aqui, um arquivo herdaria as tentativas
  // do anterior e a ordem de execução mudaria o resultado.
  await prisma.$executeRawUnsafe(`DELETE FROM "rate_limits";`);
}
