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
| `npm run screenshots`| Captura a app em mobile/tablet/desktop (claro e escuro) |

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
src/app/api/aluno/         Endpoints da área do aluno (role ALUNO, sempre pela sessão)
src/app/api/alunos/[id]/   Dados de um aluno (dono ou Personal vinculado)
src/app/auth/callback/     Troca o código do link de e-mail pela sessão
src/components/auth/       Formulários de login/registro/senha (client components)
src/components/aluno/      Telas do aluno (início, treinos, agenda, evolução, feedback, perfil)
src/components/personal/   Telas do Personal (dashboard, alunos, treinos, programação)
src/components/ui/         Componentes shadcn/ui (Base UI)
src/lib/auth/session.ts    Resolve o usuário autenticado + role (AuthContext)
src/lib/auth/guards.ts     requireAuth/requirePersonal/requireAluno + regras de ownership
src/lib/agenda/            Horários de trabalho, geração de slots e regras de conflito
src/lib/aluno/             Consultas da área do aluno (escopadas pelo perfil da sessão)
src/lib/programacoes/      Programação semanal + resolução do treino previsto por data
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

## Agendamento pelo aluno (Fase 13)

Duas telas no app do aluno: **`/aluno/agenda`** (Minha agenda) e
**`/aluno/agenda/agendar`** (Agendar treino), com as regras que o Personal configurou.

**Agendar treino** em três passos: escolher o dia numa faixa com a contagem de horários livres de
cada um (dias sem vaga vêm desabilitados), escolher o horário entre os que aparecem e confirmar,
com um resumo do que será marcado. Só entram na lista horários **realmente disponíveis** — e o
servidor revalida tudo na gravação, então passar por cima da tela não adianta.

**Minha agenda** abre com o **próximo treino** em destaque (data, horário, status e as ações),
seguido dos demais horários marcados e do histórico. Cancelar e reagendar aparecem apenas enquanto
o prazo do Personal permite; passado o prazo, a tela explica que é preciso falar com ele.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/aluno/agenda/dias` | Janela de dias com os livres de cada um, as regras e quantos atendimentos o aluno já tem |
| `GET /api/aluno/agenda/horarios?data=` | Horários que o aluno pode marcar naquela data (ou o motivo de não haver nenhum) |
| `POST /api/aluno/agendamentos` | Marca o horário |
| `PATCH /api/aluno/agendamentos/[id]` | Cancela (`status: "CANCELADO"`) ou reagenda |
| `GET/PUT /api/personal/agenda/regras` | O Personal lê e ajusta as regras |

### Regras configuradas pelo Personal

Ficam em `ConfiguracaoAgenda` (um registro por Personal; sem registro valem os padrões de
`src/lib/agenda/regras.ts`) e são editadas em **Agenda → Configurações**:

| Regra | O que faz | Padrão |
| ----- | --------- | ------ |
| `permiteAgendamento` | Se desligado, só o Personal marca | ligado |
| `antecedenciaMinHoras` | Antecedência mínima para marcar | 12h |
| `janelaDias` | Até quantos dias à frente dá para marcar | 30 |
| `cancelamentoMinHoras` | Prazo para o aluno cancelar ou reagendar sozinho | 12h |
| `maxAtivosPorAluno` | Atendimentos futuros por aluno | 3 |
| `confirmacaoAutomatica` | Se ligado, o horário do aluno já nasce confirmado | desligado |

O que é recusado (sempre com 409 e a explicação):

- **Horário passado** e horário dentro da antecedência mínima.
- **Data fora da janela** liberada.
- **Horário bloqueado** pelo Personal, ou fora das faixas de trabalho.
- **Conflito**: qualquer sobreposição com atendimento ativo — nunca dois alunos no mesmo horário.
- **Limite de marcações** atingido; e agendamento desligado pelo Personal.
- **Cancelar ou reagendar fora do prazo** — inclusive quando o aluno chama a API direto.

Um aluno só enxerga e altera os próprios agendamentos (o `where` leva o `alunoId` da sessão, então
o id de outro responde 404), e o aluno sem Personal vinculado recebe 409 com a explicação.

Correção que veio junto: a data do agendamento é gravada à meia-noite, então a separação entre
"próximos" e "histórico" passou a usar o **fim do atendimento**, e não o campo `data` — antes, tudo
que era de hoje caía no histórico.

Cobertura: `tests/agendamento-aluno-http.test.ts` (21 testes) — autorização, horários oferecidos,
passado, antecedência, janela, bloqueio, limite, agendamento desligado, confirmação automática,
dois alunos no mesmo horário, reagendamento, cancelamento dentro e fora do prazo e o isolamento
entre alunos.

## Agenda do Personal (Fase 12)

`/personal/agenda` em três vistas — **dia**, **semana** e **mês** — sobre a mesma resposta da API,
com navegação por período e o resumo do que está marcado, confirmado, a confirmar e livre.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/personal/agenda?vista=dia\|semana\|mes&data=` | A agenda do período: atendimentos, bloqueios, horários livres e as faixas de trabalho de cada dia |
| `GET /api/personal/agenda/horarios?data=` | Horários livres de um dia (alimenta o seletor de agendamento) |
| `GET/POST /api/personal/agenda/trabalho` | Configuração dos horários de trabalho |
| `DELETE /api/personal/agenda/trabalho/[id]` | Remove uma faixa |
| `POST /api/personal/agenda/bloqueios` | Bloqueia um horário ou o dia inteiro |
| `DELETE /api/personal/agenda/bloqueios/[id]` | Libera o horário |
| `POST /api/personal/agendamentos` | Marca um atendimento |
| `PATCH /api/personal/agendamentos/[id]` | Confirma, cancela, marca como concluído ou reagenda |

**Horários de trabalho** são faixas por dia da semana, com a duração de cada atendimento — o mesmo
dia aceita mais de uma faixa (manhã e tarde):

```
Segunda   06:00–12:00 · 60min
          14:00–20:00 · 60min
Terça     06:00–12:00 · 60min
          14:00–20:00 · 60min
```

Delas o sistema **gera os horários disponíveis**: cada faixa é quebrada em atendimentos da duração
configurada (uma sobra menor que a duração é descartada), e some da lista o que já está ocupado ou
bloqueado. A tela só oferece horários gerados assim — não há campo livre de hora para agendar.

Regras de conflito (validadas no servidor, não só na tela):

- **Dois alunos nunca ocupam o mesmo horário.** Qualquer sobreposição com um atendimento ativo
  (`[início, fim)` que se cruzam) responde **409** — inclusive sobreposição parcial. Encostar um
  horário no outro (08:00 logo após 07:00–08:00) é permitido.
- **Horário bloqueado não aceita agendamento** (409). Bloqueio pode ser uma faixa ou o dia inteiro;
  liberar é apagá-lo.
- Cancelar **devolve o horário** para a lista de livres; reativar um cancelado revalida o conflito.
- Reagendar revalida data e hora ignorando o próprio agendamento; mudar de horário sem informar
  status marca como **REAGENDADO**.
- Cada Personal só enxerga e altera a própria agenda; agendar aluno de outro profissional responde
  404, e mexer no agendamento alheio também.

O status ganhou **CONFIRMADO** (`AGENDADO` = à espera do aceite): o fluxo é marcar → confirmar →
marcar como concluído (`REALIZADO`), com `CANCELADO` a qualquer momento. Rótulos e cores ficam em
`src/lib/agenda/status.ts`, compartilhados com a agenda do aluno e o dashboard.

`agendamentos.data` guarda a meia-noite **local** do dia; hora fica nos campos de texto `HH:MM`, e
toda a aritmética de horário acontece em minutos (`src/lib/agenda/horarios.ts`).

Cobertura: `tests/agenda-http.test.ts` (26 testes) — autorização, faixas de trabalho (inclusive
sobreposição recusada), geração dos horários, conflito total e parcial, bloqueio/liberação, dia
inteiro bloqueado, confirmar/concluir/cancelar/reagendar, as três vistas e o isolamento entre
Personals.

## Evolução dos treinos (Fase 11)

`/aluno/evolucao` agora tem duas abas: **Treinos** (o que o aluno vem fazendo) e **Corpo** (a
bioimpedância, que já existia). O histórico sessão a sessão continua em `/aluno/historico`.

Na aba Treinos, tudo calculado a partir do que foi realmente registrado
(`GET /api/aluno/progresso`):

- **Treinos concluídos**, **sequência atual** (com a melhor sequência quando ela é maior),
  **frequência** (média de treinos por semana desde o primeiro registro) e **últimas 4 semanas**
  no formato "8 de 20 programados", comparando o feito com o que a programação previa.
- **Frequência semanal**: barras das últimas 12 semanas, com um traço marcando quantos treinos
  estavam programados em cada uma.
- **Evolução por exercício**: escolhendo o exercício, aparece a curva de carga e a progressão em
  texto - `40 kg › 42,5 kg › 45 kg › … › 57,5 kg` -, mais a variação da primeira para a última
  sessão, a melhor carga já registrada e a lista de datas com séries, repetições e carga.

Decisões que valem registro:

- **Nada é inventado.** Um exercício só entra no gráfico com **duas ou mais** sessões de carga
  numérica; com menos, ele aparece na lista "outros exercícios registrados", sem curva. Sem nenhum
  treino concluído, a aba inteira vira um estado vazio explicando que os números aparecem conforme
  o aluno treinar.
- **Carga é texto livre** na ficha ("40kg", "peso corporal", "20 lb"), porque é assim que o Personal
  escreve. `src/lib/treinos/carga.ts` extrai o número quando existe (convertendo libras) e devolve
  `null` quando não existe - é o que separa o que dá gráfico do que não dá.
- **Sequência** conta dias de treino seguidos: descanso e dias sem programação não quebram (não
  havia treino a fazer) e o dia de hoje ainda não treinado também não, porque o dia não acabou.
- Duas execuções do mesmo exercício no mesmo dia viram um ponto só - o de maior carga.
- O agrupamento é pelo exercício da biblioteca; se ele for excluído, o histórico mantém o nome
  registrado e a série continua inteira.

Cobertura: `tests/progresso-http.test.ts` (9 testes) - progressão de carga em ordem, exercício sem
carga numérica fora do gráfico, contagem de concluídos, frequência semanal, sequência atual e
melhor, previsto x realizado, isolamento entre alunos e a resposta zerada de quem ainda não treinou.

## Execução do treino (Fase 10)

"Começar treino" abre `/aluno/treinos/[id]/sessao`: uma tela por exercício, feita para o celular
na mão entre as séries.

O que ela mostra e faz:

- **Topo fixo** com o nome do treino, o progresso (`3 / 8 exercícios`), a barra de andamento e o
  cronômetro da sessão; ao lado, a trilha numerada dos exercícios (feito / atual / pendente), que
  também serve para pular direto para um deles.
- **Exercício atual** com imagem (ou o link do vídeo, quando o Personal cadastrou), grupo muscular,
  a prescrição em destaque - séries, repetições, carga e descanso - e as **observações do Personal**.
- **Séries**: um botão grande por série; marcar uma série dispara o descanso automaticamente
  (exceto na última, que emenda no próximo exercício).
- **Carga usada / repetições feitas**: campos já preenchidos com o prescrito, para o aluno corrigir
  quando treinar diferente do combinado.
- **Concluir exercício** marca o exercício, atualiza o progresso, avança e inicia o descanso.
- **Descanso**: contagem regressiva com barra, `+15s` e *Pular*, com vibração ao terminar. O fim é
  agendado por `setTimeout` (e não pela contagem), então continua correto se o navegador engasgar o
  intervalo com a tela bloqueada.
- **Resumo** antes de fechar: tempo, exercícios, séries e a lista do que foi feito, mais um campo de
  observações. Ao confirmar, aparece **"Treino concluído!"** com o resumo da sessão.

O andamento fica no `localStorage` (`pulse:sessao:<treinoId>`): recarregar a página no meio do
treino não perde nada. Uma sessão parada há mais de 6 horas é descartada em vez de retomada.

O que vai para o banco (`POST /api/aluno/treinos/[id]/execucoes`):

| Onde | O que guarda |
| ---- | ------------ |
| `historico_treinos` | data, treino, aluno, se foi concluído, observações e **duração** da sessão |
| `historico_exercicios` | um registro por exercício: ordem, nome, grupo muscular, **séries, repetições, carga**, se foi concluído |

Os itens são um **retrato do momento**: nome e grupo muscular são copiados da ficha na hora de
gravar, então renomear ou apagar um exercício depois não reescreve o passado (o vínculo com a
biblioteca vira nulo, o registro permanece). Séries, repetições e carga vêm do que o aluno fez,
caindo para o prescrito quando ele não ajusta nada; enviar um exercício que não pertence à ficha
responde 400, e a ficha de outro aluno, 404.

O histórico fica em **`/aluno/historico`** (`GET /api/aluno/historico`): cada sessão com data,
duração, exercícios concluídos e séries, expansível para ver exercício por exercício com a carga
usada. As últimas sessões também aparecem em `/aluno/treinos`.

Cobertura: `tests/execucao-http.test.ts` (11 testes) - autorização, registro completo com itens,
recusa de exercício de outra ficha, ficha inteira quando não vêm itens, validações, permanência do
retrato após a ficha mudar e o isolamento do histórico entre alunos.

## Área do aluno (Fase 9)

O app que o aluno usa: `/aluno` (início), `/aluno/treinos` (fichas e execução), `/aluno/agenda`,
`/aluno/evolucao`, `/aluno/feedback` e `/aluno/perfil`. No desktop a navegação é a sidebar; no
mobile, a barra inferior com os seis itens.

O início abre com **"Olá, [Nome] 👋"** e mostra, nesta ordem:

- **Treino de hoje** — nome da ficha, quantidade de exercícios, duração estimada e o botão
  *Começar treino* (mais o horário, quando há atendimento marcado para a data). Sem treino no dia,
  o card explica se é descanso ou se ainda não há programação.
- **Próximo treino** — a próxima data com treino previsto, o horário marcado (ou "sem horário") e
  um resumo da ficha.
- **Evolução** — os números da última avaliação com a variação em relação à anterior.
- **Último feedback** — o comentário mais recente do Personal.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/aluno/dashboard` | Tudo do início: treino de hoje, próximo, resumo, evolução e último feedback |
| `GET /api/aluno/treinos` | Fichas ativas do aluno + histórico recente de execuções |
| `GET /api/aluno/treinos/[id]` | Ficha completa, com séries, repetições, carga e descanso |
| `POST /api/aluno/treinos/[id]/execucoes` | Fecha a sessão de treino (ver [Execução do treino](#execução-do-treino-fase-10)) |
| `GET /api/aluno/historico` | Histórico de execuções, com o que foi feito em cada uma |
| `GET /api/aluno/agenda` | Agendamentos próximos e anteriores (ver [Agendamento pelo aluno](#agendamento-pelo-aluno-fase-13)) |
| `GET /api/aluno/evolucao` | Avaliações em ordem cronológica + variações por métrica |
| `GET /api/aluno/progresso` | Frequência, sequência e evolução de carga por exercício |
| `GET /api/aluno/feedbacks` | Comentários do Personal para este aluno |
| `GET/PATCH /api/aluno/perfil` | Dados do próprio aluno (nome, telefone, nascimento, altura, objetivo) |

Como o isolamento é garantido:

- **Nenhuma rota de `/api/aluno/*` aceita id de aluno.** O `alunoId` sai sempre da sessão
  (`requireAluno` → `ctx.alunoProfileId`), então não existe parâmetro para trocar e pedir os dados
  de outra pessoa.
- Consultas por id de outro recurso (uma ficha, por exemplo) levam `alunoId` no `where`: o treino
  de outro aluno responde **404**, e o mesmo vale para registrar execução nele.
- O `PATCH /api/aluno/perfil` só aceita os campos do próprio cadastro. E-mail, status e vínculo com
  o Personal ficam de fora do schema - enviá-los não muda nada.
- Um Personal recebe **403** em `/api/aluno/*` (assim como o aluno continua recebendo 403 em
  `/api/personal/*`).

Detalhes de implementação:

- **Duração estimada** (`src/lib/treinos/duracao.ts`): cada série custa ~45s de execução mais o
  descanso configurado (60s quando não há), somados 5 min de aquecimento; o resultado é arredondado
  para múltiplos de 5, porque a estimativa não tem precisão de minuto.
- **Treino de hoje / próximo treino** saem da mesma resolução da programação usada pelo Personal
  (`treinoPrevistoEm` / `proximoTreinoDoAluno`), com o horário vindo do agendamento daquela data.
- **Sequência**: dias seguidos com treino previsto *e* executado. Descanso e dias sem programação
  não quebram a contagem (não havia treino a fazer); o dia de hoje ainda não executado também não,
  porque o dia não acabou.
- **Gráfico de evolução**: SVG escrito à mão (`grafico-evolucao.tsx`), sem biblioteca de charts -
  escala com o container e respeita os tokens de tema.
- Cobertura: `tests/aluno-http.test.ts` (23 testes) cobre autorização, o conteúdo do dashboard,
  execução de treino, agenda, evolução, feedbacks e edição de perfil - sempre com dois alunos do
  mesmo Personal, para provar que um não enxerga nada do outro.

## Programação de treinos (Fase 8)

Define **qual treino o aluno faz em cada dia da semana**, dentro de um período. Fica na aba
**Treinos** da ficha do aluno (`/personal/alunos/[id]`), com a rotina semanal e o calendário das
próximas 4 semanas.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/personal/programacoes?alunoId=` | Programações do aluno (histórico) + a vigente hoje |
| `POST /api/personal/programacoes` | Cria uma programação (opcionalmente já com os dias) |
| `GET/PATCH/DELETE /api/personal/programacoes/[id]` | Detalhe, edição de nome/período e exclusão |
| `PUT /api/personal/programacoes/[id]/dias/[dia]` | Associa ou troca o treino de um dia |
| `DELETE /api/personal/programacoes/[id]/dias/[dia]` | Remove o treino do dia (vira descanso) |
| `GET /api/personal/alunos/[id]/calendario?de=&ate=` | O previsto em cada data do período (padrão: 4 semanas) |
| `GET /api/personal/alunos/[id]/treino-do-dia?data=` | O previsto em uma data (padrão: hoje) |

Modelo: `Programacao` (aluno + período) tem até 7 `ProgramacaoDia` (`diaSemana` → `treino`). O
`Treino` **não guarda mais o dia da semana** — a coluna `treinos.diaSemana` foi removida na
migration `20260905133000_programacao_de_treinos`, que converteu os dias já cadastrados em uma
"Programação inicial" por aluno.

Regras da resolução (`src/lib/programacoes/queries.ts`, o mesmo código que vai alimentar o
"Treino de hoje" do aluno):

- **Ausência de linha = descanso.** Um dia sem `ProgramacaoDia` é descanso explícito; uma data fora
  de qualquer período responde `SEM_PROGRAMACAO` (nada prescrito ainda).
- **Vale a programação mais recente.** Entre as que cobrem a data, ganha a de maior `dataInicio` —
  assim uma rotina nova substitui a anterior mesmo que a antiga tenha ficado com um período longo.
- **Criar uma nova encerra a anterior.** Programações em aberto que alcançam a nova data de início
  recebem `dataFim` na véspera, para não existirem duas rotinas valendo no mesmo dia.
- **Datas em UTC puro** (`src/lib/date-utils.ts`): `dataInicio`/`dataFim` são `@db.Date` e as
  comparações usam `getUTCDay()`, para o fuso do servidor nunca deslocar um treino de dia.
- **Isolamento**: programar aluno de outro Personal responde 404, e um treino só pode ser prescrito
  para o aluno dono da ficha (usar o treino de outro aluno também responde 404).
- Consultas em lote (`proximosTreinosDeAlunos`, `treinosPrevistosPara`) resolvem vários alunos/datas
  em uma única query — é assim que o dashboard e a listagem de alunos mostram o "próximo treino"
  sem N+1.

Cobertura: `tests/programacao-http.test.ts` (25 testes) exercita autorização, montagem da semana,
troca e remoção de dias, resolução por data, repetição na semana seguinte, virada de mês, edição de
período e a troca de programação ao longo do tempo.

## Treinos (Fase 7)

Montagem de fichas em `/personal/treinos`, com editor em `/personal/treinos/[id]`. Cada treino é
**vinculado a um aluno** e reúne exercícios da biblioteca com séries, repetições, carga, descanso
e observações. Em que dia da semana cada ficha cai é decidido na [programação](#programação-de-treinos-fase-8).

| Endpoint | O que faz |
| -------- | --------- |
| `GET/POST /api/personal/treinos` | Lista (filtros por aluno, status e busca) e cria |
| `GET/PATCH/DELETE /api/personal/treinos/[id]` | Detalhe, edição (inclui desativar) e exclusão |
| `POST /api/personal/treinos/[id]/duplicar` | Duplica com todos os exercícios, para o mesmo aluno ou outro |
| `POST /api/personal/treinos/[id]/exercicios` | Adiciona um exercício ao final da ficha |
| `PATCH/DELETE .../exercicios/[itemId]` | Edita os parâmetros ou remove (renumerando os demais) |
| `PUT .../exercicios/ordem` | Regrava a ordem dos exercícios |

Pontos de atenção:

- **Isolamento entre Personals**: criar, transferir ou duplicar um treino para aluno de outro
  profissional responde **404**, assim como usar um exercício da biblioteca alheia. Tudo é
  verificado no servidor antes de gravar.
- **Reordenação em duas fases**: `treino_exercicios` tem `UNIQUE (treinoId, ordem)` e o Postgres
  valida a cada linha atualizada — gravar as posições finais direto colidiria no meio do caminho.
  As posições passam primeiro por valores negativos e depois pelos definitivos, dentro de uma
  transação. A remoção usa o mesmo mecanismo para manter a numeração sempre 1..n.
- **Desativar x excluir**: desativar tira o treino de circulação mantendo o histórico; excluir
  remove a ficha e as execuções registradas dela (a biblioteca de exercícios não é afetada).
- A aba **Treinos** da ficha do aluno lista os treinos dele e permite criar já com o aluno fixado.

## Biblioteca de exercícios (Fase 6)

CRUD da biblioteca em `/personal/exercicios`: cadastrar, editar, buscar (nome/descrição), filtrar
por grupo muscular e por status, arquivar/restaurar e excluir. Cada exercício tem nome, grupo
muscular, descrição de execução, vídeo de referência (URL) e imagem de demonstração.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/personal/exercicios` | Lista com busca (`q`), filtro (`grupo`, `status`) e ordenação; devolve contagens e os grupos presentes |
| `POST /api/personal/exercicios` | Cadastra um exercício |
| `GET/PATCH /api/personal/exercicios/[id]` | Detalhe e edição (inclui arquivar via `ativo`) |
| `DELETE /api/personal/exercicios/[id]` | Exclui — recusa com **409** se o exercício estiver em algum treino |
| `POST /api/personal/exercicios/[id]/imagem` | Envia a imagem de demonstração para o Storage |

Decisões que valem registrar:

- **Arquivar em vez de excluir**: a FK de `treino_exercicios` é em cascata, então apagar um
  exercício em uso o removeria silenciosamente das fichas já montadas. A exclusão só é permitida
  quando o exercício não está em nenhum treino; caso contrário a API responde 409 e a interface
  oferece **arquivar** (sai da biblioteca ativa, os treinos continuam intactos).
- **Nome único por Personal**, ignorando maiúsculas — dois Personals podem ter "Supino reto".
- **Grupos musculares padronizados** em `src/lib/validations/exercicio.ts`: o banco guarda texto,
  mas a lista canônica mantém o filtro consistente.
- **Vídeo é uma URL** (link do YouTube etc.), não upload; a **imagem** é upload real para o bucket
  `exercicios` do Supabase Storage, feito pelo card depois de salvar o exercício.

## Gerenciamento de alunos (Fase 5)

CRUD completo em `/personal/alunos`, com página de detalhe em
`/personal/alunos/[id]`. Todos os endpoints exigem sessão + role PERSONAL e filtram pelo
`personalId` do próprio Personal — acessar um aluno de outro profissional responde **404**
(e não 403), para não revelar que aquele registro existe.

| Endpoint | O que faz |
| -------- | --------- |
| `GET /api/personal/alunos` | Lista com busca (`q` por nome/e-mail), filtro (`status`) e ordenação (`ordenar`); devolve também as contagens para os filtros |
| `POST /api/personal/alunos` | Cria o aluno (conta no Auth + perfil) já vinculado ao Personal |
| `GET /api/personal/alunos/[id]` | Detalhe com dados cadastrais e métricas |
| `PATCH /api/personal/alunos/[id]` | Edita dados e ativa/desativa (`status`) |
| `POST /api/personal/alunos/[id]/avatar` | Envia a foto para o Supabase Storage |

Decisões que valem registrar:

- **Cadastro pelo Personal**: a conta do aluno é criada com uma **senha temporária** gerada pelo
  sistema, exibida uma única vez para o Personal repassar. Não há envio de e-mail de convite ainda.
- **E-mail não é editável**: ele identifica a conta no Supabase Auth; alterá-lo exigiria também
  atualizar o Auth e revalidar o endereço.
- **Desativar não apaga nada**: `AlunoProfile.status` vira `INATIVO`; treinos, agenda e avaliações
  continuam disponíveis e o aluno pode ser reativado. Por isso o card "Alunos ativos" do dashboard
  passou a contar o status persistido (antes era derivado de atividade recente).
- **Foto**: upload real para o bucket público `avatars` do Supabase Storage (criado sozinho na
  primeira vez), aceitando JPG/PNG/WebP de até 2 MB.

## Dashboard do Personal (Fase 4)

`/personal` consome `GET /api/personal/dashboard` (client-side), então os estados de carregamento,
vazio e erro são reais — com botão de tentar novamente. Todo o conteúdo é filtrado pelo
`personalId` do Personal autenticado.

O endpoint devolve, em uma única chamada:

| Bloco | Conteúdo |
| ----- | -------- |
| `resumo` | total de alunos, alunos ativos, treinos de hoje, próximos agendamentos e avaliações recentes |
| `agendaDoDia` | agendamentos de hoje com horário, aluno, status e treino do dia |
| `proximosAgendamentos` | agendamentos a partir de amanhã (cancelados ficam de fora) |
| `alunosRecentes` | últimos alunos vinculados, com treino programado e última execução |
| `avaliacoesRecentes` | últimas bioimpedâncias com peso e percentual de gordura |

Definições usadas nas métricas (também exibidas na tela):
- **Alunos ativos**: com `status = ATIVO` (o Personal controla ao desativar/reativar o aluno).
- **Treinos de hoje**: treinos ativos programados para o dia da semana atual.
- **Próximos agendamentos**: futuros e não cancelados, incluindo os de hoje que ainda vão acontecer.
- **Tipo de treino** de um agendamento: derivado do treino ativo daquele aluno para o dia da semana
  da sessão (o schema não liga agendamento a treino diretamente).

`npm run db:seed` também cria dados de demonstração (exercícios, treinos, agenda, execução e
avaliações) para `personal1@teste.com`, para o dashboard ter conteúdo real em desenvolvimento.
`personal2@teste.com` fica sem dados, o que é útil para ver os estados vazios.

## Fundação visual (Fase 3)

Identidade **Pulse**: neutros grafite levemente frios com verde-elétrico como cor de energia.
Títulos em Outfit, texto em Geist, raios generosos (14px de base), sombras suaves em camadas e
microanimações curtas (`active:scale`, elevação no hover, entrada com `fade-up`).

- **Catálogo vivo** em [`/design-system`](http://localhost:3000/design-system): cores, tipografia,
  botões, badges, campos, avatares, abas, cards, métricas, toasts, modal e todos os estados.
- **Componentes** em `src/components/ui/`: `Button`, `Input`, `Select`, `Card`, `Badge`, `Avatar`,
  `Tabs`, `Modal` (bottom sheet no mobile), `Toaster` + helper `toast`, `Spinner`, `LoadingState`,
  `SkeletonCard`/`SkeletonList`, `EmptyState`, `ErrorState`, `PageHeader`, `StatCard`.
- **Layout responsivo** em `src/components/layout/`: navegação inferior no mobile (< 768px), rail
  de ícones no tablet (768-1023px) e sidebar completa no desktop (≥ 1024px).
- **Tema claro/escuro** via `next-themes`, com todos os tokens definidos nos dois modos.
- **Estados por rota**: `loading.tsx` (skeletons), `error.tsx` (com retry) e `not-found.tsx`.

Para conferir a responsividade, `npm run screenshots` captura as telas principais em três
tamanhos de tela e nos dois temas (requer a app rodando; padrão `http://127.0.0.1:3200`).

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
