-- Compatibilidade com o shadow database do Prisma.
--
-- A migration inicial cria uma foreign key de `public.users.id` para
-- `auth.users.id` (Supabase Auth). No banco real esse schema já existe e
-- pertence ao papel `supabase_auth_admin` - por isso nem tentamos criar nada
-- lá (um `CREATE TABLE IF NOT EXISTS` ainda checaria permissão no schema e
-- falharia). Num banco vazio - como o shadow database que o Prisma cria para
-- validar migrations - criamos um stub mínimo para que a FK possa existir.
--
-- O nome desta pasta é anterior ao da migration inicial de propósito: ela
-- precisa rodar antes dela quando o histórico é reaplicado do zero.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS "auth";
    CREATE TABLE "auth"."users" ("id" UUID PRIMARY KEY);
  END IF;
END
$$;
