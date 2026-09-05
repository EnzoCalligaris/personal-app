-- Execução de treino: duração da sessão + o que foi realizado em cada exercício.

ALTER TABLE "historico_treinos" ADD COLUMN "duracaoSeg" INTEGER;

CREATE TABLE "historico_exercicios" (
    "id" TEXT NOT NULL,
    "historicoId" TEXT NOT NULL,
    "exercicioId" TEXT,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "grupoMuscular" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticoes" TEXT NOT NULL,
    "carga" TEXT,
    "concluido" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,

    CONSTRAINT "historico_exercicios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "historico_exercicios_historicoId_ordem_key"
    ON "historico_exercicios"("historicoId", "ordem");

CREATE INDEX "historico_exercicios_exercicioId_idx" ON "historico_exercicios"("exercicioId");

ALTER TABLE "historico_exercicios"
    ADD CONSTRAINT "historico_exercicios_historicoId_fkey"
    FOREIGN KEY ("historicoId") REFERENCES "historico_treinos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "historico_exercicios"
    ADD CONSTRAINT "historico_exercicios_exercicioId_fkey"
    FOREIGN KEY ("exercicioId") REFERENCES "exercicios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
