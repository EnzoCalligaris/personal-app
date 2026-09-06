-- Datas de calendário passam a ser `date`, sem hora e sem fuso.
--
-- Estas três colunas guardam um DIA (o dia do atendimento, o dia em que a
-- avaliação foi feita, a data de nascimento), mas eram `timestamp`. O valor
-- gravado dependia do fuso do processo que escreveu: num servidor em UTC-3 o
-- dia 08 virava `2026-09-08 03:00`, num servidor em UTC virava
-- `2026-09-08 00:00`, e a mesma linha lida no outro fuso mudava de dia.
--
-- `date` não tem esse problema: o Postgres guarda o dia e devolve o dia.
--
-- A conversão interpreta o valor atual como UTC (é assim que ele foi gravado)
-- e o traduz para o dia no fuso de São Paulo, que é o dia que a pessoa viu na
-- tela quando marcou:
--   2026-09-08 03:00 -> 08/09 00:00 em SP -> 2026-09-08
--   2026-09-04 11:00 -> 04/09 08:00 em SP -> 2026-09-04

ALTER TABLE "agendamentos"
  ALTER COLUMN "data" TYPE DATE
  USING ("data" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;

ALTER TABLE "avaliacoes"
  ALTER COLUMN "data" TYPE DATE
  USING ("data" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;

ALTER TABLE "aluno_profiles"
  ALTER COLUMN "dataNascimento" TYPE DATE
  USING ("dataNascimento" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;
