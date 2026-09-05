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
}
