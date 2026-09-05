-- Remove a foreign key de public.users -> auth.users.
--
-- Motivo: o Prisma não gerencia o schema `auth` (do Supabase) e recusa
-- introspectar um banco com referência cruzada para um schema fora do
-- datasource (P4002), o que quebrava `prisma migrate dev`. Listar `auth` no
-- datasource faria o Prisma querer gerenciar - e potencialmente derrubar - as
-- tabelas do Supabase Auth, o que é pior.
--
-- O vínculo continua garantido pela aplicação: o cadastro cria a conta no Auth
-- e a linha em `users` na mesma operação (revertendo a conta se a segunda
-- falhar), e o seed reaproveita contas do Auth sem par em `users`.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('ATIVO', 'INATIVO');

-- AlterTable
ALTER TABLE "aluno_profiles"
  ADD COLUMN "observacoes" TEXT,
  ADD COLUMN "status" "StatusAluno" NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "aluno_profiles_personalId_status_idx" ON "aluno_profiles"("personalId", "status");
