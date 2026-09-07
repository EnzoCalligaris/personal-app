# Pulse Training

Plataforma web onde um Personal Trainer conduz seus alunos e cada aluno acompanha o próprio
treino — do primeiro cadastro à evolução mês a mês.

O Personal monta fichas, organiza a semana de cada aluno, controla a agenda, registra avaliações
de bioimpedância e comenta a evolução. O aluno abre o app, vê o treino do dia, executa série por
série, marca o horário do próximo atendimento e acompanha os próprios números — sem nunca
enxergar dados de outro aluno.

```bash
git clone <url-do-repositorio> && cd personal-app
npm install
npm run supabase:start     # sobe Postgres + Auth locais (precisa de Docker)
cp .env.example .env       # preencha com os valores impressos acima
npm run db:generate && npm run db:deploy && npm run db:seed
npm run dev                # http://localhost:3000
```

O passo a passo detalhado está em [Instalação](#9-instalação).

---

## Índice

| | | |
| --- | --- | --- |
| [1. Objetivo](#1-objetivo) | [7. Banco de dados](#7-banco-de-dados) | [13. Migrations](#13-migrations) |
| [2. Funcionalidades](#2-funcionalidades) | [8. Variáveis de ambiente](#8-variáveis-de-ambiente) | [14. Testes](#14-testes) |
| [3. Tecnologias](#3-tecnologias) | [9. Instalação](#9-instalação) | [15. Usuários de demonstração](#15-usuários-de-demonstração) |
| [4. Arquitetura](#4-arquitetura) | [10. Backend](#10-como-executar-o-backend) | [16. Build](#16-como-fazer-build) |
| [5. Estrutura de pastas](#5-estrutura-de-pastas) | [11. Frontend](#11-como-executar-o-frontend) | [17. Produção](#17-como-executar-em-produção) |
| [6. Scripts](#6-scripts) | [12. Banco](#12-como-executar-o-banco) | |

Documentação complementar: [funcionalidades em detalhe](docs/funcionalidades.md) ·
[segurança](docs/seguranca.md) · [desempenho](docs/desempenho.md) ·
[interface](docs/interface.md) · [testes](docs/testes.md)

---

## 1. Objetivo

Personal Trainers trabalham com planilha, PDF no WhatsApp e caderno de horários. O treino do aluno
mora num arquivo que envelhece, a carga de ontem se perde e o reagendamento vira conversa.

Esta plataforma resolve isso em um lugar só, com duas visões do mesmo dado:

- **Para o Personal**, uma ferramenta de trabalho: carteira de alunos, biblioteca de exercícios
  reaproveitável, fichas montadas por arrastar, programação semanal, agenda com regras próprias,
  avaliações de composição corporal e um canal de feedback.
- **Para o aluno**, um app de treino: o que fazer hoje, quanto levantar, quanto descansar, o
  histórico do que já foi feito e a evolução em gráfico — em uma interface pensada para o celular,
  com o aparelho na mão no meio da série.

O isolamento entre contas é regra de projeto, não detalhe: um aluno acessa apenas os próprios
dados, e um Personal apenas os alunos vinculados a ele. Isso é verificado por
[testes que tentam a invasão](docs/seguranca.md), endpoint por endpoint.

## 2. Funcionalidades

### Personal Trainer

| Área | O que faz |
| --- | --- |
| **Alunos** | Cadastro com senha temporária gerada, busca, edição, desativação sem perder histórico |
| **Exercícios** | Biblioteca própria com grupo muscular, imagem e vídeo; arquivamento em vez de exclusão quando o exercício já está em uso |
| **Treinos** | Fichas com séries, repetições, carga, descanso e observações; reordenação, duplicação e transferência entre alunos |
| **Programação** | Monta a semana do aluno (Segunda: Treino A, Quarta: Treino B...) e resolve o treino previsto para qualquer data |
| **Agenda** | Vistas de dia, semana e mês; horários de trabalho, bloqueios, confirmação, cancelamento e reagendamento, sem permitir conflito |
| **Avaliações** | Bioimpedância com todos os campos opcionais — preenche só o que o equipamento mediu |
| **Feedback** | Comentários por aluno, com status de leitura |
| **Perfil** | Dados profissionais e as regras que governam a agenda (antecedência, janela, cancelamento) |

### Aluno

| Área | O que faz |
| --- | --- |
| **Início** | Treino de hoje, próximo atendimento, resumo da evolução e o último comentário do Personal |
| **Treino** | Tela de execução: exercício atual, séries marcáveis, cronômetro de descanso e registro do que foi feito |
| **Histórico** | Todos os treinos realizados, com duração, cargas e repetições |
| **Evolução** | Progressão de carga por exercício, frequência, sequência e os gráficos de composição corporal |
| **Agenda** | Marca, cancela e reagenda dentro das regras do Personal, vendo apenas horários realmente livres |
| **Feedback** | Comentários recebidos, com o mais recente em destaque |
| **Perfil** | Foto, contato e dados pessoais |

Notificações internas avisam os dois lados (treino novo, avaliação cadastrada, agendamento
confirmado ou cancelado), com a arquitetura preparada para e-mail, WhatsApp e push.

O detalhamento de cada uma está em [docs/funcionalidades.md](docs/funcionalidades.md).

## 3. Tecnologias

| Camada | Escolha | Versão |
| --- | --- | --- |
| Framework | [Next.js](https://nextjs.org) (App Router, Server Components, Route Handlers) | 16.3 |
| Linguagem | TypeScript, modo estrito | 5 |
| Interface | [React](https://react.dev) | 19.2 |
| Estilo | [Tailwind CSS](https://tailwindcss.com) | 4 |
| Componentes | [shadcn/ui](https://ui.shadcn.com) sobre [Base UI](https://base-ui.com) | — |
| Banco | PostgreSQL, no [Supabase](https://supabase.com) | 17 |
| ORM | [Prisma](https://www.prisma.io) com driver adapter (`@prisma/adapter-pg`) | 7.10 |
| Autenticação | [Supabase Auth](https://supabase.com/docs/guides/auth) (e-mail e senha, bcrypt) | — |
| Arquivos | Supabase Storage (fotos de perfil e de exercícios) | — |
| Validação | [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com) | 4 / 7 |
| Testes | [Vitest](https://vitest.dev) contra servidor real + [Playwright](https://playwright.dev) | 5 / 1.62 |

> **Atenção ao atualizar:** Next.js 16 e Prisma 7 trouxeram mudanças que quebram o que se
> encontra em tutoriais mais antigos — `middleware.ts` virou `proxy.ts` com export `proxy`, e a
> conexão do banco saiu do `schema.prisma` para o `prisma.config.ts`. A referência confiável é
> `node_modules/next/dist/docs` e <https://pris.ly/d/major-version-upgrade>.

## 4. Arquitetura

**Uma aplicação só.** Não há um servidor de frontend e outro de backend: o Next.js serve as duas
coisas no mesmo processo. As páginas são Server Components que renderizam componentes de cliente;
esses componentes falam com os Route Handlers em `src/app/api/**`, que são o backend.

```
Navegador
   │
   ├── páginas (Server Components) ──── src/proxy.ts ── redireciona por sessão e role
   │
   └── fetch /api/** ─── Route Handler
                             │
                             ├── guarda (requireAuth / requirePersonal / requireAluno)
                             │      └── valida o token no Supabase Auth
                             │      └── lê a role no banco (nunca do token)
                             │
                             ├── validação do corpo (Zod)
                             │
                             └── consulta (src/lib/**/queries.ts) ── Prisma ── PostgreSQL
```

### Três decisões que explicam o resto

**O dono do dado vem sempre da sessão, nunca da requisição.** Toda consulta carrega o dono no
`where` (`{ id, personalId }`, `{ id, alunoId }`), então um id de terceiro simplesmente não casa.
Recurso que existe mas não é seu responde **404, não 403** — 403 confirmaria que o dado existe.

**As páginas e a API se protegem de forma independente.** O `proxy.ts` cuida só de redirecionar
páginas; ele não roda em `/api/**`. Cada endpoint aplica a própria guarda, que lê a role do banco
— um token antigo não consegue manter um acesso revogado.

**Regras de negócio ficam em funções puras quando dá.** Sobreposição de horários, geração de
slots, prazos de cancelamento e datas de calendário vivem em `src/lib/agenda/` e
`src/lib/date-utils.ts`, testáveis sem banco e sem HTTP.

Mais detalhes em [docs/seguranca.md](docs/seguranca.md) e [docs/desempenho.md](docs/desempenho.md).

### Datas e fuso horário

A plataforma atende no Brasil, e o horário que o Personal escreve na agenda é horário de
São Paulo — não o do servidor. Duas categorias, tratadas de formas diferentes:

| | O que é | Como trafega | Como é guardado |
| --- | --- | --- | --- |
| **Data de calendário** | Um dia: o dia do atendimento, o dia da avaliação, a data de nascimento | Texto `YYYY-MM-DD` | Coluna `date` — sem hora e sem fuso |
| **Instante** | Um ponto no tempo: quando o treino foi executado, quando o feedback foi escrito | ISO completo | `timestamp` |

A ponte entre as duas — "que instante é 07:00 do dia 08?" — passa por `src/lib/fuso.ts`, que
usa `America/Sao_Paulo` explicitamente. Nada usa o relógio do processo: sem isso, o mesmo
código se comporta diferente na máquina de quem desenvolve (UTC−3) e no contêiner de produção
(UTC), fazendo "hoje" virar amanhã às 21:00 e cada atendimento ser lido três horas antes.

No frontend, `src/lib/format.ts` distingue os dois: data de calendário é ancorada e lida em
UTC (um dia não se converte); instante é exibido no fuso da aplicação, para que o horário que
o Personal vê seja o mesmo que o aluno vê, mesmo que um dos dois esteja viajando.

**O servidor dos testes sobe em UTC** (`tests/global-setup.ts`), que é o fuso de produção. Assim
a suíte inteira — e não só `tests/fuso.test.ts` e `tests/fuso-http.test.ts` — prova que nada
depende do relógio do servidor.

## 5. Estrutura de pastas

```
docs/                        Documentação por assunto
prisma/
  schema.prisma              Modelo de dados
  migrations/                12 migrations versionadas
prisma.config.ts             Configuração do Prisma 7 (datasource via env)
supabase/config.toml         Stack local do Supabase (portas, auth, redirects)
scripts/
  seed-test-users.ts         Usuários e dados de demonstração
  seed-ui-estresse.ts        Conta com conteúdo extremo, para revisar a interface
  guard-seed.ts              Trava que impede seed em banco não-local
  auditoria-ui.ts            Varre as telas em 4 tamanhos (overflow, erros, toque)
  screenshots.ts             Capturas em mobile/tablet/desktop, claro e escuro
src/
  app/                       Rotas (App Router)
    api/auth/                Cadastro, login, logout, recuperação de senha
    api/me/                  Usuário autenticado (qualquer role)
    api/personal/            Endpoints do Personal (role PERSONAL)
    api/aluno/               Endpoints do aluno (role ALUNO, escopo pela sessão)
    api/alunos/[id]/         Dados de um aluno (o próprio ou o Personal vinculado)
    personal/                Telas do Personal
    aluno/                   Telas do aluno
    error.tsx                Anteparo de erro por rota
    global-error.tsx         Anteparo do layout raiz
  components/
    ui/                      Componentes base (shadcn/ui sobre Base UI)
    layout/                  Casca: sidebar, topo, navegação inferior, notificações
    personal/                Telas do Personal
    aluno/                   Telas do aluno
  lib/
    auth/                    session.ts (AuthContext) e guards.ts (regras de acesso)
    agenda/                  Horários, geração de slots, conflitos e regras
    aluno/                   Consultas da área do aluno
    programacoes/            Semana do aluno e treino previsto por data
    avaliacoes/ feedbacks/   Bioimpedância e comentários
    notificacoes/            Eventos, mensagens e canais de entrega
    supabase/                Clientes (server, admin, cookies, proxy)
    prisma.ts                Cliente Prisma
    env.ts                   Leitura das variáveis com erro acionável
  proxy.ts                   Sessão e redirecionamento por role (só páginas)
  types/                     Tipos compartilhados
tests/                       21 arquivos, 377 testes
Dockerfile                   Imagem de produção
```

## 6. Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (frontend + backend) |
| `npm run build` | Build de produção |
| `npm start` | Roda o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Suíte completa (377 testes) |
| `npm run db:generate` | Gera o Prisma Client a partir do schema |
| `npm run db:migrate` | Cria e aplica migrations em desenvolvimento |
| `npm run db:deploy` | Aplica migrations pendentes (produção) |
| `npm run db:push` | Sincroniza o schema sem criar migration |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:seed` | Cria usuários e dados de demonstração |
| `npm run supabase:start` | Sobe a stack local do Supabase (Docker) |
| `npm run supabase:stop` | Para a stack local |
| `npm run supabase:status` | Reimprime URLs e chaves locais |
| `npm run ui:audit` | Revisa as telas nos 4 tamanhos |
| `npm run ui:estresse` | Cria a conta de conteúdo extremo |
| `npm run screenshots` | Capturas em vários tamanhos e temas |

## 7. Banco de dados

PostgreSQL. O schema da aplicação vive em `public`, ao lado do schema `auth` gerenciado pelo
Supabase — `users.id` é uma foreign key para `auth.users.id`, então conta e perfil nascem e morrem
juntos.

### Modelos

| Grupo | Modelos |
| --- | --- |
| Contas | `User`, `PersonalProfile`, `AlunoProfile` |
| Treino | `Exercicio`, `Treino`, `TreinoExercicio` |
| Programação | `Programacao`, `ProgramacaoDia` |
| Execução | `HistoricoTreino`, `HistoricoExercicio` |
| Agenda | `Disponibilidade`, `Agendamento`, `Bloqueio`, `ConfiguracaoAgenda` |
| Acompanhamento | `Avaliacao`, `Feedback`, `Notificacao` |

Enums: `Role`, `DiaSemana`, `StatusAluno`, `StatusAgendamento`, `TipoNotificacao`.

### Duas convenções que evitam bug

**Multi-tenant por coluna.** Quase toda tabela carrega `personalId` e/ou `alunoId`. É o que
permite escopar cada consulta pelo dono, em vez de confiar em filtro na aplicação.

**Execução guarda um retrato, não uma referência.** `HistoricoTreino` copia o nome da ficha e
`HistoricoExercicio` copia nome, grupo, séries, repetições e carga do momento em que o treino foi
feito. Se a ficha mudar — ou for excluída — o histórico continua contando o que realmente
aconteceu.

**O histórico é do aluno.** Excluir uma ficha é uma ação do Personal sobre um modelo de treino, e
não pode apagar o que já foi realizado: a referência (`historico_treinos.treinoId`) usa
`ON DELETE SET NULL`, e o registro segue completo pelo retrato. A interface mostra "Ficha
removida" quando não há mais para onde apontar.

## 8. Variáveis de ambiente

Todas em [`.env.example`](.env.example), com a origem de cada valor. Copie para `.env` e preencha
— **nenhuma credencial vai para o repositório** (`.env*` está no `.gitignore`).

| Variável | Para que serve | Onde pegar |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto. Pública, vai para o navegador | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima. Pública; sozinha não dá acesso a nada | Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta.** Gerencia contas do Auth. Só no servidor | Settings → API → `service_role` |
| `DATABASE_URL` | Conexão usada pela aplicação. Em produção, a do **pooler** (porta 6543) | Settings → Database → Connection pooling |
| `DIRECT_URL` | Conexão direta (porta 5432), usada só pelo Prisma CLI nas migrations | Settings → Database |
| `NEXT_PUBLIC_SITE_URL` | Endereço público da aplicação. Origem dos links de recuperação de senha — precisa estar autorizada no Supabase Auth | O domínio onde a aplicação está publicada |
| `RATE_LIMIT_IP_HEADER` | *Opcional.* De qual header ler o IP do cliente no limite de tentativas das rotas de autenticação. Padrão `x-forwarded-for`; num CDN, use o header dele (ex.: `cf-connecting-ip`) | Documentação do seu proxy/CDN |

Localmente, `npm run supabase:start` imprime todos esses valores; `DATABASE_URL` e `DIRECT_URL`
são iguais (não há pooler local).

Se faltar alguma, a aplicação não sobe e diz qual é e onde encontrá-la (`src/lib/env.ts`) — em vez
de quebrar mais adiante, dentro de uma requisição.

## 9. Instalação

**Pré-requisitos:** [Node.js 22+](https://nodejs.org), [Docker](https://docs.docker.com/get-docker/)
em execução e a [CLI do Supabase](https://supabase.com/docs/guides/local-development).

Nada precisa ser criado na nuvem: a stack local sobe Postgres, Auth, Storage e uma caixa de
e-mail de teste na sua máquina.

**1. Clone e instale as dependências**

```bash
git clone <url-do-repositorio>
cd personal-app
npm install
```

**2. Suba a stack local do Supabase**

```bash
npm run supabase:start
```

Na primeira vez isso baixa as imagens Docker e demora alguns minutos. Ao terminar, imprime as
credenciais locais.

**3. Configure o `.env`**

```bash
cp .env.example .env
```

Preencha com os valores impressos no passo anterior:

| Valor impresso | Variável |
| --- | --- |
| `API URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon key` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role key` | `SUPABASE_SERVICE_ROLE_KEY` |
| `DB URL` | `DATABASE_URL` **e** `DIRECT_URL` |

Para reimprimir depois: `npm run supabase:status`.

**4. Prepare o banco**

```bash
npm run db:generate    # gera o Prisma Client
npm run db:deploy      # aplica as 12 migrations
npm run db:seed        # cria os usuários e dados de demonstração
```

**5. Rode a aplicação**

```bash
npm run dev
```

Abra <http://localhost:3000> e entre com um dos [usuários de demonstração](#15-usuários-de-demonstração).

### Serviços locais

| Endereço | O que é |
| --- | --- |
| <http://localhost:3000> | A aplicação |
| <http://127.0.0.1:54323> | Supabase Studio (inspecionar o banco) |
| <http://127.0.0.1:54324> | Caixa de e-mail de teste (recuperação de senha) |
| `127.0.0.1:54322` | PostgreSQL |

## 10. Como executar o backend

O backend são os Route Handlers em `src/app/api/**`, servidos pelo **mesmo processo** do frontend.
Não existe comando separado: `npm run dev` sobe os dois.

```bash
npm run dev      # backend + frontend em http://localhost:3000
```

Para conferir se a API está de pé:

```bash
curl -i http://localhost:3000/api/me     # 401 sem sessão é a resposta correta
```

São 58 endpoints. Todos exigem sessão, exceto login, cadastro, logout e recuperação de senha.

## 11. Como executar o frontend

Mesmo comando — no Next.js as duas camadas são a mesma aplicação:

```bash
npm run dev
```

São 25 páginas: as públicas (apresentação, login, cadastro, recuperação de senha), a área do
Personal em `/personal/**` e a do aluno em `/aluno/**`. O acesso a cada área é decidido pela role
da conta; entrar como aluno em uma tela do Personal redireciona de volta.

Há também um catálogo dos componentes de interface em <http://localhost:3000/design-system>.

## 12. Como executar o banco

```bash
npm run supabase:start     # sobe Postgres, Auth, Storage e a caixa de e-mail
npm run supabase:status    # reimprime URLs e chaves
npm run supabase:stop      # para tudo (os dados ficam no volume Docker)
npm run db:studio          # navega pelos dados no Prisma Studio
```

### Alternativa: só o Postgres, sem Supabase

Serve para mexer apenas no schema. Login, cadastro e upload de imagem não funcionam nesse modo,
porque dependem do Supabase Auth e do Storage.

```bash
docker run -d --name personal-app-db \
  -e POSTGRES_USER=personal -e POSTGRES_PASSWORD=personal -e POSTGRES_DB=personal_app \
  -p 55432:5432 postgres:17-alpine
```

No `.env`, deixe as variáveis do Supabase em branco e aponte só o banco:

```
DATABASE_URL="postgresql://personal:personal@localhost:55432/personal_app"
DIRECT_URL="postgresql://personal:personal@localhost:55432/personal_app"
```

As migrations aplicam normalmente: a primeira delas cria um `auth.users` mínimo quando esse schema
não existe.

## 13. Migrations

São 12 migrations versionadas em `prisma/migrations/`, escritas à mão e aplicadas com
`migrate deploy`.

```bash
npm run db:deploy      # aplica o que falta (desenvolvimento e produção)
npm run db:migrate     # cria uma nova a partir de mudanças no schema.prisma
```

Ao mudar o `schema.prisma`, gere a migration com `npm run db:migrate`, confira o SQL gerado e
versione a pasta junto com o código. Depois de mudar o schema, rode `npm run db:generate` para o
TypeScript enxergar os novos tipos.

O histórico aplica limpo em um banco vazio — a primeira migration cria um `auth.users` mínimo
apenas quando o schema `auth` não existe, para nunca colidir com o do Supabase real.

## 14. Testes

```bash
npm test                              # 377 testes, 21 arquivos
npx vitest run tests/agenda-http.test.ts   # um arquivo só
```

A suíte sobe um servidor Next de produção e fala com ele por HTTP, contra o Postgres e o Supabase
Auth locais — sem mock de banco nem de sessão. O que o teste exercita é o mesmo caminho do
navegador: cookie, guarda de rota, consulta e resposta. Os dados de teste vivem no domínio
`@example.com` e são apagados ao final, preservando os de demonstração.

| Frente | Cobertura |
| --- | --- |
| Regras de negócio | Agenda, conflitos, programação, execução, evolução |
| Segurança | 30 testes que tentam a invasão em cada endpoint |
| Desempenho | Orçamento de consultas ao banco, com detecção de N+1 |
| Modelo de dados | Relações, unicidade e cascatas |

Detalhes, incluindo como a suíte é validada por mutação, em [docs/testes.md](docs/testes.md).

## 15. Usuários de demonstração

Criados por `npm run db:seed`, junto com treinos, agenda, avaliações e histórico de exemplo.

**Senha para todos: `Teste@12345`**

| E-mail | Perfil | Vínculo |
| --- | --- | --- |
| `personal1@teste.com` | Personal | Tem os alunos 1 e 2, agenda e avaliações |
| `personal2@teste.com` | Personal | Tem o aluno 3 — útil para ver as telas vazias |
| `aluno1@teste.com` | Aluno | Vinculado a `personal1` |
| `aluno2@teste.com` | Aluno | Vinculado a `personal1` |
| `aluno3@teste.com` | Aluno | Vinculado a `personal2` |

> Contas de desenvolvimento, com senha pública. `npm run db:seed` é bloqueado quando
> `DATABASE_URL` não aponta para um banco local.

Bom para conferir o isolamento: `personal1` não enxerga o `aluno3`, e `aluno1` não enxerga nada
do `aluno2`.

## 16. Como fazer build

```bash
npm run build
```

Compila frontend e backend juntos e valida os tipos — erro de TypeScript reprova o build. Gera
também `.next/standalone`, um servidor com apenas as dependências que ele usa (é o que a imagem
Docker copia).

```bash
npm start        # roda o build em http://localhost:3000
```

As variáveis `NEXT_PUBLIC_*` são embutidas no bundle **em tempo de build**: precisam existir
quando o `npm run build` roda, não apenas na execução.

## 17. Como executar em produção

O banco e a autenticação são o Supabase gerenciado; o que sobe é só o servidor Next.

### 1. Variáveis

As mesmas do [item 8](#8-variáveis-de-ambiente), apontando para o projeto real. Duas exigem
atenção:

- **`DATABASE_URL`** deve ser a de **connection pooling** (porta 6543). O servidor abre conexões
  por requisição; sem o pooler o limite do Postgres estoura.
- **`DIRECT_URL`** é a conexão direta (porta 5432) — migrations não passam pelo pooler.

### 2. Migrations

Passo separado, **antes** de publicar a nova versão:

```bash
npm run db:deploy
```

Rodar no start do contêiner faria duas réplicas migrarem o mesmo banco ao mesmo tempo.

### 3. Subir

```bash
npm ci && npm run build && npm start
```

Ou via Docker:

```bash
docker build -t personal-app \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://SEU-PROJETO.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<sua-anon-key>" .

docker run --rm -p 3000:3000 --env-file .env.producao personal-app
```

A imagem roda como usuário sem privilégios, não embute segredo nenhum e não executa migrations.

### Antes de publicar

- [ ] `npm test` e `npm run lint` passando
- [ ] `.env` de produção preenchido, `SUPABASE_SERVICE_ROLE_KEY` só no servidor
- [ ] `npm run db:deploy` aplicado
- [ ] **Não** rodar `npm run db:seed` nem `npm run ui:estresse` — criam contas com senha pública
- [ ] HTTPS na frente: o `Strict-Transport-Security` e o cookie `Secure` dependem disso
- [ ] Limite de tentativas de login na borda, se o provedor oferecer

### O que já vem configurado

| Item | Onde |
| --- | --- |
| Cabeçalhos de segurança e CSP | `next.config.ts` |
| `Cache-Control: private, no-store` nas APIs | `next.config.ts` |
| Sem `X-Powered-By` | `poweredByHeader: false` |
| Cookie de sessão `HttpOnly` / `Secure` / `SameSite` | `src/lib/supabase/cookies.ts` |
| CORS fechado (nenhuma origem liberada) | padrão do Next, verificado em teste |
| Proxy fecha o acesso se faltar configuração em produção | `src/lib/supabase/middleware.ts` |
| Erro de servidor não vaza detalhe para a tela | rotas de API + `error.tsx` / `global-error.tsx` |
| Seeds bloqueados fora de banco local | `scripts/guard-seed.ts` |
