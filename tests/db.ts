import { prisma } from "@/lib/prisma";

/**
 * Limpa apenas os dados criados pelos testes.
 *
 * As factories criam usuários no domínio `@example.com`; apagá-los em
 * `auth.users` cascateia para `public.users` (FK users.id -> auth.users.id) e,
 * a partir dele, para perfis, treinos, agendamentos, avaliações etc.
 *
 * Escopar assim (em vez de TRUNCATE nas tabelas) preserva os usuários de
 * desenvolvimento criados por `npm run db:seed` (domínio `@teste.com`), que
 * antes eram destruídos a cada execução da suíte.
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE email LIKE '%@example.com';`);
}
