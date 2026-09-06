-- Duração padrão dos atendimentos, sugerida ao criar uma faixa de trabalho.

ALTER TABLE "configuracoes_agenda" ADD COLUMN "duracaoPadraoMin" INTEGER NOT NULL DEFAULT 60;
