-- Regras de agendamento definidas pelo Personal (antecedência, cancelamento, janela).

CREATE TABLE "configuracoes_agenda" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "permiteAgendamento" BOOLEAN NOT NULL DEFAULT true,
    "antecedenciaMinHoras" INTEGER NOT NULL DEFAULT 12,
    "janelaDias" INTEGER NOT NULL DEFAULT 30,
    "cancelamentoMinHoras" INTEGER NOT NULL DEFAULT 12,
    "maxAtivosPorAluno" INTEGER NOT NULL DEFAULT 3,
    "confirmacaoAutomatica" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_agenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "configuracoes_agenda_personalId_key" ON "configuracoes_agenda"("personalId");

ALTER TABLE "configuracoes_agenda"
    ADD CONSTRAINT "configuracoes_agenda_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
