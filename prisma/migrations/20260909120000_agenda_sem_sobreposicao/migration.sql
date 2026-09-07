-- Dois atendimentos ativos do mesmo Personal não podem se sobrepor - e agora
-- quem garante isso é o banco.
--
-- Até aqui a regra vivia só na aplicação: consulta-se a agenda, conclui-se que
-- o horário está livre e grava-se em seguida. Entre a conclusão e a gravação
-- cabe outra requisição inteira, então duas pessoas marcando o mesmo horário no
-- mesmo instante passavam as duas. O Personal só descobria na hora do
-- atendimento, com dois alunos na porta.
--
-- POR QUE UMA MIGRATION SQL ESCRITA À MÃO
--
-- O Prisma não representa EXCLUDE constraints no schema. Uma `@@unique` em
-- (personalId, data, horaInicio) seria representável, mas resolveria o problema
-- errado: 09:00-10:00 e 09:30-10:30 têm horaInicio diferente e mesmo assim se
-- sobrepõem. A regra real é sobreposição de intervalo, e é o que está abaixo.
-- A constraint fica invisível para o Prisma - ele não a cria nem a remove -,
-- por isso ela é criada aqui e documentada em `prisma/schema.prisma`.
--
-- POR QUE MINUTOS, E NÃO HORÁRIO
--
-- `horaInicio`/`horaFim` são TEXT no formato HH:MM. Montar um range com
-- `("horaInicio")::time` é recusado pelo PostgreSQL: o cast de texto para hora
-- depende de configuração de sessão e a expressão precisa ser IMMUTABLE para
-- entrar num índice. A conversão para minutos é aritmética de string pura -
-- imutável de verdade, e sem envolver instante, data ou fuso em momento algum.
-- É a mesma conta que `paraMinutos()` faz em src/lib/agenda/horarios.ts.

-- 1. Necessária para combinar igualdade (personalId, data) com sobreposição de
--    range no mesmo índice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. "07:30" -> 450.
CREATE OR REPLACE FUNCTION agenda_minutos(hora text) RETURNS integer
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT substring(hora from 1 for 2)::int * 60 + substring(hora from 4 for 2)::int
$$;

-- 3. Recusa-se a seguir se o banco já tiver sobreposições ativas.
--
--    Criar a constraint com dados sujos falharia de qualquer forma, com uma
--    mensagem que não diz onde está o problema. E resolver o conflito é uma
--    decisão de negócio - qual dos dois atendimentos vale? -, não algo que uma
--    migration deva escolher sozinha. Nada é apagado aqui.
DO $$
DECLARE
  total integer;
  amostra text;
BEGIN
  SELECT count(*), min(format('%s %s-%s x %s-%s (personal %s)',
                              a.data, a."horaInicio", a."horaFim",
                              b."horaInicio", b."horaFim", a."personalId"))
    INTO total, amostra
  FROM "agendamentos" a
  JOIN "agendamentos" b
    ON a."personalId" = b."personalId" AND a."data" = b."data" AND a."id" < b."id"
  WHERE a."status" IN ('AGENDADO', 'CONFIRMADO', 'REAGENDADO')
    AND b."status" IN ('AGENDADO', 'CONFIRMADO', 'REAGENDADO')
    AND agenda_minutos(a."horaInicio") < agenda_minutos(b."horaFim")
    AND agenda_minutos(b."horaInicio") < agenda_minutos(a."horaFim");

  IF total > 0 THEN
    RAISE EXCEPTION
      'Existem % pares de agendamentos ativos sobrepostos. O primeiro: %.', total, amostra
      USING HINT =
        'Decida qual atendimento vale e cancele o outro (status = CANCELADO), '
        'preservando as duas linhas para o histórico. Depois rode a migration de novo.';
  END IF;
END $$;

-- 4. A regra.
--
--    Só participam os status que ainda seguram o horário. CANCELADO e REALIZADO
--    ficam de fora: um horário desmarcado volta a ficar livre, e um atendimento
--    já realizado é histórico - nenhum dos dois impede uma nova marcação. É a
--    mesma lista de STATUS_ATIVOS em src/lib/agenda/status.ts.
--
--    O range é [início, fim), então encostar não é sobrepor: 09:00-10:00 e
--    10:00-11:00 convivem, como já acontece na aplicação.
ALTER TABLE "agendamentos"
  ADD CONSTRAINT "agendamentos_sem_sobreposicao"
  EXCLUDE USING gist (
    "personalId" WITH =,
    "data" WITH =,
    int4range(agenda_minutos("horaInicio"), agenda_minutos("horaFim")) WITH &&
  )
  WHERE ("status" IN ('AGENDADO', 'CONFIRMADO', 'REAGENDADO'));
