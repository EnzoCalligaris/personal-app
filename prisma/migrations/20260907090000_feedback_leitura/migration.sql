-- Status de leitura do feedback + índice para listar notificações por data.

ALTER TABLE "feedbacks" ADD COLUMN "lidoEm" TIMESTAMP(3);
ALTER TABLE "feedbacks" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "notificacoes_userId_createdAt_idx" ON "notificacoes"("userId", "createdAt");
