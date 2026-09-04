# Personal App

Plataforma web para Personal Trainers e seus alunos: gestão de alunos, treinos personalizados por dia, agenda de horários, avaliações de bioimpedância com evolução e feedbacks.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Prisma 7](https://www.prisma.io) + PostgreSQL ([Supabase](https://supabase.com))
- [Supabase Auth](https://supabase.com/docs/guides/auth) (login/roles Personal x Aluno)
- [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com) para formulários

## Setup local

A autenticação usa Supabase Auth, então o jeito mais simples de desenvolver é com a **stack
local do Supabase** (Postgres + Auth + captura de e-mails), via Docker. Isso não requer nenhum
projeto na nuvem - tudo roda na sua máquina.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Suba a stack local do Supabase (requer Docker rodando):
   ```bash
   npm run supabase:start
   ```
   Na primeira vez isso baixa as imagens Docker (Postgres, Auth, Studio, captura de e-mail) e
   imprime as credenciais locais. Copie `.env.example` para `.env` e preencha com os valores
   impressos (`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DB_URL` →
   `DATABASE_URL`/`DIRECT_URL`). Para reimprimir depois: `npm run supabase:status`.
3. Aplique as migrations do Prisma nesse banco (schema `public`, ao lado do schema `auth` do
   Supabase):
   ```bash
   npm run db:generate
   npm run db:migrate deploy
   ```
4. Crie os usuários de teste (2 Personals, 3 Alunos - veja a tabela abaixo):
   ```bash
   npm run db:seed
   ```
5. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Abra [http://localhost:3000](http://localhost:3000). O Supabase Studio local fica em
`http://127.0.0.1:54323` e a caixa de e-mail de teste (recuperação de senha etc.) em
`http://127.0.0.1:54324`.

Para produção, aponte as mesmas variáveis para um projeto Supabase real (Settings → API / Database)
em vez da stack local.

### Usuários de teste (`npm run db:seed`)

Senha para todos: **`Teste@12345`**

| E-mail                | Role     | Vínculo              |
| ---------------------- | -------- | --------------------- |
| `personal1@teste.com` | PERSONAL | -                      |
| `personal2@teste.com` | PERSONAL | -                      |
| `aluno1@teste.com`    | ALUNO    | vinculado a personal1 |
| `aluno2@teste.com`    | ALUNO    | vinculado a personal1 |
| `aluno3@teste.com`    | ALUNO    | vinculado a personal2 |

Útil para testar as regras de acesso: `personal1` só deve ver `aluno1`/`aluno2`; `aluno1` só deve
ver os próprios dados (nunca os de `aluno2` ou `aluno3`).

### Alternativa: só o banco (sem Supabase), para trabalhar apenas no schema

```bash
docker run -d --name personal-app-db \
  -e POSTGRES_USER=personal -e POSTGRES_PASSWORD=personal -e POSTGRES_DB=personal_app \
  -p 55432:5432 postgres:16-alpine
```

No `.env`, deixe as variáveis `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` em branco (a
autenticação fica inativa) e aponte só o banco:
```
DATABASE_URL="postgresql://personal:personal@localhost:55432/personal_app"
DIRECT_URL="postgresql://personal:personal@localhost:55432/personal_app"
```
Nesse modo a migration que vincula `users` a `auth.users` (Supabase) falha, então use
`npm run db:push` em vez de `db:migrate` e remova essa constraint do schema antes.

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
| `npm run db:seed`    | Cria os usuários de teste (Supabase Auth + perfis) |
| `npm run supabase:start` | Sobe a stack local do Supabase (Docker)  |
| `npm run supabase:stop`  | Para a stack local do Supabase           |
| `npm run supabase:status`| Reimprime URLs/keys da stack local       |
| `npm run test`       | Testes automatizados (schema, autorização, auth HTTP) |

## Estrutura

```
supabase/config.toml       Config da stack local do Supabase (auth, portas, redirect URLs)
prisma/schema.prisma       Modelo de dados (users, treinos, agenda, avaliações...)
prisma.config.ts           Configuração do Prisma 7 (datasource via env)
scripts/seed-test-users.ts Cria os usuários de teste
src/app/                   Rotas (App Router)
src/app/api/auth/          Cadastro, login, logout, esqueci/redefinir senha
src/app/api/me/            Dados do usuário autenticado (qualquer role)
src/app/api/personal/      Endpoints administrativos (role PERSONAL)
src/app/api/alunos/[id]/   Dados de um aluno (dono ou Personal vinculado)
src/app/auth/callback/     Troca o código do link de e-mail pela sessão
src/components/auth/       Formulários de login/registro/senha (client components)
src/components/ui/         Componentes shadcn/ui (Base UI)
src/lib/auth/session.ts    Resolve o usuário autenticado + role (AuthContext)
src/lib/auth/guards.ts     requireAuth/requirePersonal/requireAluno + regras de ownership
src/lib/prisma.ts          Cliente Prisma (adapter-pg)
src/lib/supabase/          Clientes Supabase (browser, server, admin, middleware)
src/proxy.ts               Proxy (antigo middleware) - sessão + redirecionamento por role
src/types/                 Tipos compartilhados
tests/                     Testes automatizados (schema, guards, auth HTTP end-to-end)
```

> Nota: este projeto usa Next.js 16 e Prisma 7, que introduziram mudanças relevantes desde versões
> anteriores (ex.: `middleware.ts` → `proxy.ts` com export `proxy`; conexão do banco sai do
> `schema.prisma` e vai para `prisma.config.ts`). Consulte `node_modules/next/dist/docs` e
> https://pris.ly/d/major-version-upgrade para detalhes ao atualizar dependências.

## Autenticação e autorização (Fase 2)

- **Senhas**: nunca tocadas pela aplicação - o Supabase Auth (GoTrue) faz o hash com bcrypt e
  guarda só o hash em `auth.users.encrypted_password`.
- **Sessão**: cookies httpOnly geridos pelo `@supabase/ssr` (`src/lib/supabase/server.ts` nas
  rotas/páginas, `src/proxy.ts` faz o refresh a cada request).
- **Role**: gravada em `app_metadata.role` no momento do cadastro (`PERSONAL`/`ALUNO`) - o proxy lê
  direto do usuário autenticado, sem round-trip ao banco, para redirecionar `/personal` e `/aluno`
  por role.
- **Ownership**: `src/lib/auth/guards.ts` centraliza as regras - um Aluno só acessa o próprio
  `AlunoProfile`; um Personal só acessa Alunos com `personalId` igual ao seu próprio perfil;
  endpoints administrativos (`/api/personal/**`) exigem `requirePersonal()`. Acesso negado a um
  aluno específico responde `404` (não `403`), para não revelar a terceiros que aquele aluno
  existe.
- **Recuperação de senha**: `resetPasswordForEmail` (PKCE) → e-mail com link → `/auth/callback`
  troca o código pela sessão → `/redefinir-senha` chama `updateUser({ password })`. Em dev, os
  e-mails caem no Mailpit (`http://127.0.0.1:54324`), não são enviados de verdade.
