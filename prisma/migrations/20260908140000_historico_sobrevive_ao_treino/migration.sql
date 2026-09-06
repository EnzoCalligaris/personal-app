-- O histórico de execução passa a sobreviver à exclusão da ficha.
--
-- Antes, `historico_treinos.treinoId` era obrigatório e cascateava: o Personal
-- excluía um treino antigo e o aluno perdia o registro de tê-lo feito. O que
-- o aluno realizou é dado dele e não deveria depender da ficha continuar
-- existindo.
--
-- Os itens (`historico_exercicios`) já guardavam um retrato completo - nome,
-- grupo muscular, séries, repetições, carga e observações. O que faltava era o
-- nome da própria ficha, que só existia na relação. É o que a coluna abaixo
-- resolve, para o histórico continuar dizendo QUAL treino foi feito.

-- 1. Retrato do nome, preenchido a partir da relação atual.
ALTER TABLE "historico_treinos" ADD COLUMN "treinoNome" TEXT;

UPDATE "historico_treinos" h
SET "treinoNome" = t."nome"
FROM "treinos" t
WHERE t."id" = h."treinoId";

-- Nenhuma linha órfã é esperada (a FK era obrigatória), mas um registro sem
-- nome seria pior que um rótulo genérico.
UPDATE "historico_treinos" SET "treinoNome" = 'Treino removido' WHERE "treinoNome" IS NULL;

ALTER TABLE "historico_treinos" ALTER COLUMN "treinoNome" SET NOT NULL;

-- 2. A referência à ficha vira opcional e deixa de cascatear.
ALTER TABLE "historico_treinos" DROP CONSTRAINT "historico_treinos_treinoId_fkey";
ALTER TABLE "historico_treinos" ALTER COLUMN "treinoId" DROP NOT NULL;

ALTER TABLE "historico_treinos"
  ADD CONSTRAINT "historico_treinos_treinoId_fkey"
  FOREIGN KEY ("treinoId") REFERENCES "treinos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
