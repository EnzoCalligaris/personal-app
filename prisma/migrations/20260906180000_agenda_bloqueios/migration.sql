-- Agenda do Personal: status "confirmado" e bloqueios de horário.

ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'CONFIRMADO' AFTER 'AGENDADO';

CREATE TABLE "bloqueios" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bloqueios_personalId_data_idx" ON "bloqueios"("personalId", "data");

ALTER TABLE "bloqueios"
    ADD CONSTRAINT "bloqueios_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
