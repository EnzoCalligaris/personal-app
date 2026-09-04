# Personal App

Plataforma web para Personal Trainers e seus alunos: gestão de alunos, treinos personalizados por dia, agenda de horários, avaliações de bioimpedância com evolução e feedbacks.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Prisma 7](https://www.prisma.io) + PostgreSQL ([Supabase](https://supabase.com))
- [Supabase Auth](https://supabase.com/docs/guides/auth) (login/roles Personal x Aluno)
- [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com) para formulários

## Setup local

1. Copie `.env.example` para `.env`.
   - Para desenvolver **sem** Supabase configurado ainda, aponte `DATABASE_URL`/`DIRECT_URL` para um
     Postgres local (veja "Banco local com Docker" abaixo). O app funciona normalmente nesse modo —
     autenticação fica inativa até o Supabase ser configurado (Fase 2).
   - Para usar Supabase, preencha `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
     `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (connection pooling, porta 6543) e `DIRECT_URL`
     (conexão direta, porta 5432, usada pelo Prisma CLI).
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Gere o Prisma Client e aplique o schema no banco:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
4. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Abra [http://localhost:3000](http://localhost:3000).

### Banco local com Docker

```bash
docker run -d --name personal-app-db \
  -e POSTGRES_USER=personal -e POSTGRES_PASSWORD=personal -e POSTGRES_DB=personal_app \
  -p 55432:5432 postgres:16-alpine
```

No `.env`:
```
DATABASE_URL="postgresql://personal:personal@localhost:55432/personal_app"
DIRECT_URL="postgresql://personal:personal@localhost:55432/personal_app"
```

## Scripts

| Script              | Descrição                                  |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento                 |
| `npm run build`      | Build de produção                           |
| `npm run start`      | Roda o build de produção                    |
| `npm run lint`       | ESLint                                       |
| `npm run db:generate`| Gera o Prisma Client a partir do schema      |
| `npm run db:migrate` | Cria/aplica migrations em desenvolvimento    |
| `npm run db:push`    | Sincroniza o schema com o banco sem migration|
| `npm run db:studio`  | Abre o Prisma Studio                         |
| `npm run test`       | Testes de integração do schema (vitest)      |

## Estrutura

```
prisma/schema.prisma    Modelo de dados (users, treinos, agenda, avaliações...)
prisma.config.ts        Configuração do Prisma 7 (datasource via env)
src/app/                Rotas (App Router)
src/components/ui/      Componentes shadcn/ui
src/lib/prisma.ts       Cliente Prisma (adapter-pg)
src/lib/supabase/       Clientes Supabase (browser, server, middleware)
src/proxy.ts            Proxy (antigo middleware) - refresh de sessão e proteção de rotas
src/types/               Tipos compartilhados
tests/                   Testes de integração (schema/relacionamentos Prisma)
```

> Nota: este projeto usa Next.js 16, que introduziu mudanças relevantes desde versões anteriores
> (ex.: `middleware.ts` foi renomeado para `proxy.ts` com export `proxy`). Consulte
> `node_modules/next/dist/docs` para detalhes ao atualizar dependências.
