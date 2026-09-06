# Desempenho

O que foi medido, o que foi otimizado e o que ficou como está - com os
números. Para a visão geral, veja o [README](../README.md).

## Revisão de desempenho

Medir antes de mexer: o gargalo não estava onde a intuição apontava.

### O que foi medido

`tests/desempenho.test.ts` conta as idas ao banco de cada função de leitura, com 20 alunos,
2 treinos e 3 execuções cada. O gancho fica em `src/lib/prisma.ts`, ligado por
`PRISMA_LOG_QUERIES=1` (os testes ligam sozinhos).

A marca de um N+1 é o custo **crescer com o volume**, então o teste principal roda a mesma
listagem contra dois Personals - um com 20 alunos, outro com 2 - e exige o mesmo número de
consultas. Os dois lados têm a mesma *forma* de dados (atendimentos, faixas de horário), senão a
comparação mediria "vazio x cheio" em vez de crescimento.

**Nenhum N+1.** Todas as listagens custam o mesmo com 2 e com 20 alunos:

| Função | Consultas (2 alunos) | Consultas (20 alunos) |
| --- | --: | --: |
| `listarAlunos` | 12 | 12 |
| `listarTreinos` | 10 | 10 |
| `listarAvaliacoes` | 7 | 7 |
| `listarFeedbacks` | 11 | 11 |
| `agendaDoPeriodo` | 10 | 10 |
| `getDashboardData` | 27 | 27 |

O número é constante porque o Prisma emite uma consulta por relação incluída, e as resoluções em
lote (`proximosTreinosDeAlunos`, `treinosPrevistosPara`) já usam `in` em vez de laço.

### O gargalo real: autenticação em dobro

Com o banco descartado, a latência apontou sozinha. **Todo** endpoint levava ~165-210ms, inclusive
`/api/notificacoes`, que faz uma única consulta. Piso igual em endpoints de custo tão diferente é
sinal de custo fixo por requisição - não de consulta lenta.

Era o proxy. O matcher excluía só arquivos estáticos, então ele rodava também em `/api/**` e
chamava `supabase.auth.getUser()` - uma ida de rede ao servidor de Auth. Logo em seguida a guarda
do handler (`requireAuth`) chamava **a mesma validação de novo**. Duas por requisição, e a
primeira não decidia nada: o proxy só redireciona páginas; numa rota de API ele não protege coisa
alguma - quem protege é a guarda, que lê a role do banco.

Excluir `/api/` do matcher tirou uma validação inteira de cada chamada:

| Endpoint | Antes | Depois |
| --- | --: | --: |
| `/api/personal/dashboard` | 209ms | 118ms |
| `/api/personal/alunos` | 191ms | 99ms |
| `/api/personal/treinos` | 190ms | 94ms |
| `/api/personal/agenda?vista=semana` | 184ms | 103ms |
| `/api/notificacoes` | 170ms | 86ms |

**Mediana geral: 99ms, contra ~180ms.** A segurança é exatamente a mesma - `tests/seguranca-http.test.ts`
verifica os 58 endpoints um a um, e continua passando.

### Também corrigido

- **Imagens da biblioteca e da ficha com `loading="lazy"`**: a grade de exercícios mostra dezenas
  de imagens de uma vez e quase todas nascem fora da tela. Na sessão de treino a imagem é o
  conteúdo principal, então lá vale só `decoding="async"`.

### Medido e deixado como está

- **Requisições por tela: 2** (a da tela + notificações), sem nenhuma duplicada.
- **Busca com debounce**: seis teclas geram uma requisição.
- **Peso transferido**: 14kB na entrada, 54kB na tela mais pesada (agenda), comprimido.
- **`getDashboardData` em 27 consultas** é o maior número da aplicação, mas é constante e o painel
  junta seis blocos. Espremer isso pediria consulta manual em SQL no lugar dos `include` - troca
  ruim de legibilidade por ~40ms.
- **React Compiler desligado e pouca memoização manual**: sem nenhuma medição mostrando
  re-renderização cara, ligar o compilador seria mexer no build por palpite.
- **`next/image` não adotado**: exigiria `remotePatterns` para o host do Supabase e um caminho a
  mais de falha, para imagens que já entram limitadas a 2 MB e são exibidas pequenas.

### Ponto em aberto

As listagens de alunos, treinos e exercícios não têm paginação - avaliações, feedbacks e
notificações têm teto (100, 100 e o limite do sino). Na escala de um Personal (dezenas de alunos)
isso não pesa; se a carteira crescer para centenas, é o primeiro lugar a mudar, e aí paginação é
mudança de interface, não de consulta.
