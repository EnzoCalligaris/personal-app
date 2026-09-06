-- Novos eventos notificáveis: treino alterado e agendamento feito pelo aluno.

ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'TREINO_ALTERADO' AFTER 'NOVO_TREINO';
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'NOVO_AGENDAMENTO' AFTER 'TREINO_ALTERADO';
