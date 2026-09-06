# Segurança

Auditoria completa de autenticação, autorização e proteção de dados, com foco
em IDOR/BOLA. Para a visão geral, veja o [README](../README.md).

## Revisão de segurança

Auditoria completa de autenticação, autorização, endpoints, validação e proteção de dados
pessoais, com foco em **IDOR/BOLA** — trocar um id na requisição para alcançar dados de
outra pessoa.

### Como o acesso é decidido

O id do usuário **nunca vem da requisição**: sai sempre da sessão. `getAuthContext()`
(`src/lib/auth/session.ts`) valida o token com `supabase.auth.getUser()` — que confere a
assinatura no servidor de Auth, e não apenas decodifica o JWT — e lê a `role` **do banco**,
não do token. Sobre ele, quatro guardas em `src/lib/auth/guards.ts`:

| Guarda                | Uso                          | Recusa com |
| --------------------- | ---------------------------- | ---------- |
| `requireAuth`         | rotas de qualquer logado     | 401        |
| `requirePersonal`     | `/api/personal/**`           | 401 / 403  |
| `requireAluno`        | `/api/aluno/**`              | 401 / 403  |
| `loadAccessibleAluno` | recursos de um aluno         | 404        |

Toda consulta a um recurso carrega o dono no `where` (`{ id, personalId }`,
`{ id, alunoId }`), então um id de terceiro simplesmente não casa. Recurso que existe mas
**não é seu responde 404, não 403** — 403 confirmaria a existência do dado alheio.

As páginas (`/personal/**`, `/aluno/**`) são protegidas de novo no `proxy.ts`, que redireciona
quem não tem a role. As rotas de API não confiam nisso: cada uma aplica a própria guarda.

### O que foi testado

`tests/seguranca-http.test.ts` (30 testes) executa os ataques contra o servidor real, em vez
de apenas reler o código. Dois Personals com dados espelhados e dois alunos do mesmo Personal:

- **Sem autenticação** — 40 endpoints protegidos, todos 401, sem vazar dados no corpo.
- **Aluno em endpoint administrativo** — 26 rotas `/api/personal/**`, todas 403.
- **Personal em endpoint do aluno** — 15 rotas `/api/aluno/**`, todas 403.
- **Aluno acessando outro aluno** — ficha, execução, agendamento, perfil e notificação do
  colega: 404 em todas; as listagens só trazem o que é dele.
- **Personal acessando outro Personal** — 8 leituras e 21 escritas por id (treino, item de
  treino, exercício, programação, dia da programação, avaliação, feedback, agendamento,
  bloqueio, faixa de horário): 404 em todas, com verificação no banco de que nada mudou, e
  controle positivo de que o dono continua acessando.
- **Mass assignment** — o aluno tentando mudar o próprio `personalId`, `status` e e-mail pelo
  perfil; o Personal tentando criar recursos para aluno alheio, transferir um treino próprio
  para esse aluno ou usar exercício da biblioteca de outro. Todos barrados (os schemas Zod são
  listas de permissão: campo não declarado é descartado).
- **Sessão e cabeçalhos** — flags do cookie, ausência de CORS, invalidação no logout e
  mensagem idêntica no login e na recuperação de senha para e-mail existente e inexistente.

**Nenhuma falha de IDOR/BOLA foi encontrada** nos 58 endpoints.

### Correções aplicadas

| Achado | Risco | Correção |
| --- | --- | --- |
| Cookie de sessão sem `HttpOnly`/`Secure` — ele guarda access **e** refresh token, então qualquer XSS viraria tomada de conta duradoura | Alto | `src/lib/supabase/cookies.ts` marca `HttpOnly`, `SameSite=lax` e `Secure` (produção). Removido o `createBrowserClient`, que não era usado e não leria mais a sessão |
| Senha temporária do aluno com 32 bits (`Pulse` + 8 hex) | Médio | 12 caracteres sorteados sem viés com `randomInt` (~59 bits), em grupos legíveis para ditar |
| Sem cabeçalhos de segurança | Médio | `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` e CSP (`frame-ancestors`, `base-uri`, `form-action`, `object-src`) |
| Resposta de API podia ser guardada em cache compartilhado | Baixo | `Cache-Control: private, no-store` em `/api/:path*` |
| Caminho da foto no Storage derivável do id do aluno (bucket público) | Baixo | Sufixo aleatório no nome do arquivo |

### Verificado sem necessidade de mudança

- **CORS** — nenhuma origem liberada; sem `Access-Control-Allow-Origin`, resposta de API não é
  legível por outro site. Com `SameSite=lax`, requisição de escrita cross-site não leva cookie.
- **Senhas** — hash a cargo do Supabase Auth (bcrypt); mínimo de 8 caracteres; a aplicação
  nunca vê nem guarda a senha. Login e recuperação respondem igual para e-mail existente e
  inexistente.
- **Sessão** — access token de 1h com refresh; `signOut()` revoga no servidor (testado).
- **Upload** — lista de permissão de MIME (JPG/PNG/WebP, sem SVG), 2 MB, limites repetidos no
  bucket.
- **Variáveis de ambiente** — `.env*` fora do git; `SUPABASE_SERVICE_ROLE_KEY` só em
  `src/lib/supabase/admin.ts` (com `server-only`), no seed e nos testes; no cliente, apenas a
  URL e a chave anônima, ambas públicas por natureza.
- **Erros** — mensagens genéricas para o usuário; detalhe só no log do servidor.

### Pontos em aberto (decisão de produto)

- **Buckets de imagem são públicos.** As URLs não são mais deriváveis, mas quem tiver o link vê
  a imagem sem autenticação. Fechar o bucket exige URLs assinadas com validade — mudança de
  arquitetura, não aplicada aqui.
- **Sem rate limiting próprio no login.** Vale o limite embutido do Supabase Auth. Um limite por
  IP na borda (ex.: Vercel WAF) é recomendável em produção.
- **`proxy.ts` decide a role das páginas pelo `app_metadata` do token**, que pode ficar
  desatualizado se a role mudar no banco. As rotas de API leem a role do banco, então o dado em
  si continua protegido.
