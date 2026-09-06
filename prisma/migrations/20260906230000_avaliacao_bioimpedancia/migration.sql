-- Campos de bioimpedância: todos opcionais, porque cada balança mede um conjunto.

ALTER TABLE "avaliacoes" ADD COLUMN "massaMuscular" DOUBLE PRECISION;
ALTER TABLE "avaliacoes" ADD COLUMN "massaOssea" DOUBLE PRECISION;
ALTER TABLE "avaliacoes" ADD COLUMN "aguaPercentual" DOUBLE PRECISION;
ALTER TABLE "avaliacoes" ADD COLUMN "aguaLitros" DOUBLE PRECISION;
ALTER TABLE "avaliacoes" ADD COLUMN "gorduraVisceral" DOUBLE PRECISION;
ALTER TABLE "avaliacoes" ADD COLUMN "metabolismoBasal" INTEGER;
ALTER TABLE "avaliacoes" ADD COLUMN "idadeMetabolica" INTEGER;
ALTER TABLE "avaliacoes" ADD COLUMN "observacoes" TEXT;
