# Testes

Como a suíte é organizada e como ela é validada. Para rodar, veja o
[README](../README.md#14-testes).

## Testes automatizados

```bash
npm test          # 373 testes, 20 arquivos
```

A suíte sobe um servidor Next de produção (`next start` na porta 3100, via `tests/global-setup.ts`)
e fala com ele por HTTP, contra o Postgres e o Supabase Auth locais. Não há mock de banco nem de
sessão: o que o teste exercita é o mesmo caminho do navegador — cookie de sessão, guarda de rota,
consulta e resposta. `resetDb()` apaga só o domínio `@example.com`, preservando os usuários de
desenvolvimento criados por `npm run db:seed`.

| Arquivo | Testes | Cobre |
| --- | --: | --- |
| `regras-agenda.test.ts` | 42 | Aritmética de horários, sobreposição, geração de slots, regras de antecedência/cancelamento e datas de calendário em UTC (puro, sem I/O) |
| `seguranca-http.test.ts` | 30 | IDOR/BOLA, roles, mass assignment, sessão, cabeçalhos e CORS |
| `agenda-http.test.ts` | 26 | Disponibilidade, conflitos, bloqueios, confirmação/cancelamento/reagendamento e as três vistas |
| `programacao-http.test.ts` | 25 | Montagem da semana, treino previsto por data, calendário e troca de programação |
| `treinos-http.test.ts` | 25 | Criação, edição da ficha, exercícios, ordem, duplicação, transferência e exclusão |
| `aluno-http.test.ts` | 23 | Dashboard, fichas, agenda, evolução, feedbacks e perfil do próprio aluno |
| `agendamento-aluno-http.test.ts` | 21 | Horários oferecidos, marcação, limites, cancelamento e reagendamento pelo aluno |
| `contas-http.test.ts` | 21 | Cadastro, login, origem da role, recuperação/troca de senha e aluno desativado |
| `alunos-http.test.ts` | 18 | Cadastro, senha temporária, busca, edição, desativação e isolamento |
| `feedbacks-http.test.ts` | 18 | Escrita, leitura, status de lido, permissões e notificação |
| `avaliacoes-http.test.ts` | 17 | Campos opcionais, correção, exclusão, histórico e isolamento |
| `exercicios-http.test.ts` | 16 | Biblioteca por Personal, nome repetido, arquivamento e exclusão |
| `auth-http.test.ts` | 16 | Login, autorização, roles e redirecionamento de página |
| `notificacoes-http.test.ts` | 13 | Eventos que notificam, contador, marcar como lida e canais |
| `schema.test.ts` | 13 | Modelo de dados: relações, unicidade e cascatas |
| `execucao-http.test.ts` | 11 | Registro da sessão de treino e histórico |
| `perfil-http.test.ts` | 11 | Perfil do Personal e do aluno, regras da agenda e foto |
| `guards.test.ts` | 10 | `canAccessAluno` e `loadAccessibleAluno` |
| `progresso-http.test.ts` | 9 | Progressão de carga, frequência, sequência e aderência |
| `dashboard-http.test.ts` | 8 | Números, agenda do dia e listas do Personal |

### Como a suíte é validada

Somar testes não prova que eles pegam regressão. As regras críticas foram verificadas por
**mutação**: quebrar a regra no código de propósito e confirmar que a suíte acusa.

| Regra quebrada | Testes que acusaram |
| --- | --- |
| `where` do treino do aluno sem `alunoId` (IDOR) | 9, em 3 arquivos |
| `where` do item de treino sem o dono | 1 (verificação no banco) |
| `sobrepoe` com `<=` (atendimentos encostados viram conflito) | 13, em 4 arquivos |
| Dia da programação sem checar o dono | 1 (depois de corrigido o teste) |

A última linha valeu a auditoria: o teste passava com a regra quebrada, porque o payload apontava
o dia para o mesmo treino que já estava lá — uma escrita bem-sucedida seria invisível. Corrigido
para apontar a um treino do outro Personal.

Daí a convenção destes testes: em toda tentativa de escrita indevida, **conferir o efeito no
banco, não só o status da resposta**. Uma rota pode gravar e só então responder 404.
