-- Programação de treinos: o dia da semana sai do treino e passa a ser
-- definido por uma rotina com período de vigência. Assim o mesmo treino pode
-- ser prescrito em vários dias e trocar a rotina preserva o histórico.

-- CreateTable
CREATE TABLE "programacoes" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nome" TEXT,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programacao_dias" (
    "id" TEXT NOT NULL,
    "programacaoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "treinoId" TEXT NOT NULL,

    CONSTRAINT "programacao_dias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programacoes_personalId_idx" ON "programacoes"("personalId");
CREATE INDEX "programacoes_alunoId_dataInicio_idx" ON "programacoes"("alunoId", "dataInicio");
CREATE INDEX "programacao_dias_treinoId_idx" ON "programacao_dias"("treinoId");
CREATE UNIQUE INDEX "programacao_dias_programacaoId_diaSemana_key" ON "programacao_dias"("programacaoId", "diaSemana");

-- AddForeignKey
ALTER TABLE "programacoes" ADD CONSTRAINT "programacoes_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programacoes" ADD CONSTRAINT "programacoes_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programacao_dias" ADD CONSTRAINT "programacao_dias_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "programacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programacao_dias" ADD CONSTRAINT "programacao_dias_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "treinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migração de dados: cada aluno com treinos ativos ganha uma programação
-- vigente a partir de hoje, reproduzindo os dias que estavam nos treinos.
INSERT INTO "programacoes" ("id", "personalId", "alunoId", "nome", "dataInicio", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."personalId", t."alunoId", 'Programação inicial', CURRENT_DATE, NOW(), NOW()
FROM (SELECT DISTINCT "personalId", "alunoId" FROM "treinos" WHERE "ativo" = true) t;

-- Um treino por dia: se dois treinos ativos disputavam o mesmo dia, fica o mais recente.
INSERT INTO "programacao_dias" ("id", "programacaoId", "diaSemana", "treinoId")
SELECT DISTINCT ON (p."id", t."diaSemana")
       gen_random_uuid()::text, p."id", t."diaSemana", t."id"
FROM "treinos" t
JOIN "programacoes" p ON p."alunoId" = t."alunoId"
WHERE t."ativo" = true
ORDER BY p."id", t."diaSemana", t."createdAt" DESC;

-- O default do updatedAt era só para a migração de dados acima.
ALTER TABLE "programacoes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropIndex / AlterTable: o dia agora vive na programação.
DROP INDEX "treinos_alunoId_diaSemana_idx";
CREATE INDEX "treinos_alunoId_idx" ON "treinos"("alunoId");
ALTER TABLE "treinos" DROP COLUMN "diaSemana";
