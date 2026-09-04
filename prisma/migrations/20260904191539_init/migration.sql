-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PERSONAL', 'ALUNO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGENDADO', 'CANCELADO', 'REALIZADO', 'REAGENDADO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NOVO_TREINO', 'AGENDAMENTO_CONFIRMADO', 'AGENDAMENTO_CANCELADO', 'AGENDAMENTO_REAGENDADO', 'NOVA_AVALIACAO', 'NOVO_FEEDBACK', 'LEMBRETE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_profiles" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "cref" TEXT,

    CONSTRAINT "personal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno_profiles" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "personalId" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "altura" DOUBLE PRECISION,
    "objetivo" TEXT,

    CONSTRAINT "aluno_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicios" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupoMuscular" TEXT NOT NULL,
    "descricao" TEXT,
    "videoUrl" TEXT,
    "imagemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinos" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treino_exercicios" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticoes" TEXT NOT NULL,
    "carga" TEXT,
    "descansoSeg" INTEGER,
    "observacoes" TEXT,

    CONSTRAINT "treino_exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_treinos" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "dataExecucao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,

    CONSTRAINT "historico_treinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidades" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "disponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGENDADO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso" DOUBLE PRECISION,
    "percentualGordura" DOUBLE PRECISION,
    "massaMagra" DOUBLE PRECISION,
    "massaGorda" DOUBLE PRECISION,
    "imc" DOUBLE PRECISION,
    "medidas" JSONB,
    "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "avaliacaoId" TEXT,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "personal_profiles_userId_key" ON "personal_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_profiles_userId_key" ON "aluno_profiles"("userId");

-- CreateIndex
CREATE INDEX "aluno_profiles_personalId_idx" ON "aluno_profiles"("personalId");

-- CreateIndex
CREATE INDEX "exercicios_personalId_idx" ON "exercicios"("personalId");

-- CreateIndex
CREATE INDEX "treinos_personalId_idx" ON "treinos"("personalId");

-- CreateIndex
CREATE INDEX "treinos_alunoId_diaSemana_idx" ON "treinos"("alunoId", "diaSemana");

-- CreateIndex
CREATE INDEX "treino_exercicios_exercicioId_idx" ON "treino_exercicios"("exercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "treino_exercicios_treinoId_ordem_key" ON "treino_exercicios"("treinoId", "ordem");

-- CreateIndex
CREATE INDEX "historico_treinos_treinoId_idx" ON "historico_treinos"("treinoId");

-- CreateIndex
CREATE INDEX "historico_treinos_alunoId_dataExecucao_idx" ON "historico_treinos"("alunoId", "dataExecucao");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_personalId_diaSemana_horaInicio_key" ON "disponibilidades"("personalId", "diaSemana", "horaInicio");

-- CreateIndex
CREATE INDEX "agendamentos_personalId_data_idx" ON "agendamentos"("personalId", "data");

-- CreateIndex
CREATE INDEX "agendamentos_alunoId_data_idx" ON "agendamentos"("alunoId", "data");

-- CreateIndex
CREATE INDEX "avaliacoes_personalId_idx" ON "avaliacoes"("personalId");

-- CreateIndex
CREATE INDEX "avaliacoes_alunoId_data_idx" ON "avaliacoes"("alunoId", "data");

-- CreateIndex
CREATE INDEX "feedbacks_personalId_idx" ON "feedbacks"("personalId");

-- CreateIndex
CREATE INDEX "feedbacks_alunoId_createdAt_idx" ON "feedbacks"("alunoId", "createdAt");

-- CreateIndex
CREATE INDEX "feedbacks_avaliacaoId_idx" ON "feedbacks"("avaliacaoId");

-- CreateIndex
CREATE INDEX "notificacoes_userId_lida_idx" ON "notificacoes"("userId", "lida");

-- AddForeignKey
ALTER TABLE "personal_profiles" ADD CONSTRAINT "personal_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_profiles" ADD CONSTRAINT "aluno_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno_profiles" ADD CONSTRAINT "aluno_profiles_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicios" ADD CONSTRAINT "exercicios_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino_exercicios" ADD CONSTRAINT "treino_exercicios_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "treinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino_exercicios" ADD CONSTRAINT "treino_exercicios_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "exercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_treinos" ADD CONSTRAINT "historico_treinos_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "treinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_treinos" ADD CONSTRAINT "historico_treinos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "personal_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Supabase Auth)
-- Vincula public.users ao usuário correspondente em auth.users. Se o usuário
-- for removido do Auth, a linha em public.users (e o perfil Personal/Aluno)
-- é removida em cascata.
ALTER TABLE "users" ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
