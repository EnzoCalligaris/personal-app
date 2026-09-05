-- Arquivamento de exercícios: `ativo` permite tirar um exercício da
-- biblioteca sem apagá-lo (a FK para treino_exercicios é em cascata e o
-- removeria de todas as fichas).

-- Alinha o default de aluno_profiles.updatedAt com o datamodel: quem escreve
-- é sempre o Prisma, que preenche o campo.
ALTER TABLE "aluno_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
-- O default temporário preenche as linhas existentes; depois ele sai, para o
-- banco ficar igual ao datamodel.
ALTER TABLE "exercicios"
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "exercicios" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "exercicios_personalId_ativo_idx" ON "exercicios"("personalId", "ativo");
