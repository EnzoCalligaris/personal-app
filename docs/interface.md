# Interface

Revisão das telas em quatro tamanhos, com prioridade para o celular. Para a
visão geral, veja o [README](../README.md).

## Revisão de interface

Todas as 23 telas conferidas em quatro tamanhos - smartphone (390), tablet (820), notebook (1280)
e desktop (1920) - com prioridade para o celular.

```bash
npm run ui:audit     # percorre tudo e reporta; capturas em .auditoria-ui/
```

`scripts/auditoria-ui.ts` faz a parte que o olho não faz bem: mede o que ultrapassa a largura da
viewport e **aponta o elemento culpado** (ignorando quem tem rolagem horizontal própria, que é
intencional), coleta erros de console e mede alvos de toque no celular. O resto - espaçamento,
tipografia, hierarquia - foi revisado nas capturas.

**Overflow horizontal: zero** nas 92 combinações de tela e rota. **Erros de console: zero.**

### Corrigido

| Problema | Onde | Correção |
| --- | --- | --- |
| Semana da agenda ilegível no tablet: 7 colunas em ~100px truncavam o aluno para "A." | `agenda/vistas.tsx` | O grid passa a valer de `xl` (1280px), onde a coluna tem ~140px. Abaixo disso, um cartão por dia - o mesmo padrão que já funcionava no celular |
| Vista de mês no celular: as pastilhas viravam "07:..." em células de ~50px | `agenda/vistas.tsx` | Um ponto por atendimento, colorido por status; o toque abre o dia com os detalhes. As pastilhas com hora e nome voltam a partir de `sm` |
| A navegação inferior ficava na tela durante o treino, roubando altura e convidando ao toque errado no meio de uma série | `layout/bottom-nav.tsx` | Some na rota de sessão, que já tem saída própria (o × no topo). O botão "Concluir exercício" assume o rodapé - ~64px a mais de conteúdo |
| "0 exercício(s)", "1 treinos seguidos", "1 avaliações registradas" | 11 componentes | Helper `plural()` em `lib/format.ts`, com forma irregular opcional (`plural(2, "avaliação", "avaliações")`) |
| Título do grupo colado nos campos no modal de avaliação | `avaliacao-form-modal.tsx` | `<legend>` é a legenda do fieldset e fica fora do fluxo flex, então o `gap` não a alcançava: margem explícita |
| Ação principal da agenda vinha depois das secundárias no celular | `agenda/agenda.tsx` | "Novo agendamento" lidera a linha em telas pequenas |
| Botões de tema e notificações com 36px - abaixo dos 44px que o próprio design system define | `top-bar.tsx`, `notificacoes.tsx`, `auth-shell.tsx`, `page.tsx` | Aplicada a utility `.tap-target` que já existia |
| Link da marca sem nome acessível quando o wordmark some: o leitor de tela anunciava só "link" | `layout/brand.tsx` | `aria-label` quando renderiza apenas o símbolo |

### Segunda passada: tema escuro, conteúdo extremo e celular deitado

A primeira passada rodou em tema claro, retrato, com os dados de demonstração - curtos e
arrumados. Isso deixa de fora justamente onde o layout costuma ceder. A segunda passada cobriu:

```bash
npm run ui:estresse                       # cria a conta de conteúdo extremo
UI_PERFIL=estresse UI_TEMA=escuro npm run ui:audit
```

`scripts/seed-ui-estresse.ts` monta uma conta com nome de 57 caracteres, uma palavra de 50
caracteres **sem espaço nenhum**, 12 exercícios num treino, observações longas, seis avaliações
com todos os campos e agenda cheia (cinco atendimentos por dia). `UI_TEMA=escuro` e o viewport
`celular-deitado` (844x390) completam a matriz. A conta vive em `@example.com`, então `npm test`
a remove junto com os dados de teste; recrie quando precisar.

| Problema | Como apareceu | Correção |
| --- | --- | --- |
| Uma palavra de 50 caracteres sem espaço alargava o documento de 390 para **515px** e arrastava a barra fixa junto | Só com conteúdo extremo | `overflow-wrap: break-word` no `body`: rede de proteção para a classe inteira do problema (nome digitado sem espaço, e-mail longo, URL). Só age quando a palavra não caberia, e não interfere em `truncate` |
| Abas do aluno nasciam cortadas nas duas pontas, com a aba ativa parcialmente escondida e **inalcançável** - `scrollLeft` não fica negativo | Só no celular, com 5 abas | `justify-content: safe center` no `TabsList`: centraliza quando cabe, alinha ao início quando transborda. Corrige todo `TabsList` que rola, não só este |
| Celular deitado: a imagem do exercício sozinha ocupava mais que os 390px de altura da tela, e a barra "Concluir exercício" virava estática (o layout de `md` entra pela largura de 844px) e sumia abaixo da dobra | Só em paisagem | Variante `md-alto` (largura de tablet **e** altura suficiente) para o cabeçalho e a barra de ação, e teto de `38vh` na mídia. O botão principal volta a ficar sempre visível |

Verificado e correto: a cor das variações na Evolução é semântica por métrica, não pelo sinal -
massa magra caindo aparece em alerta, gordura caindo em sucesso (conferido pela cor computada, não
a olho). O tema escuro não tem problema de layout nem de contraste nas 26 telas.

### Microinterações

A base já era boa e contida - `fade-up` na entrada, `shimmer` nos esqueletos, transição de cor nos
controles, `active:scale-95` nos alvos de toque, indicador animado na navegação inferior, barra de
progresso do treino com transição, e um bloco `prefers-reduced-motion` que corta tudo isso para
quem pede menos movimento. Não havia motivo para empilhar mais.

Foi adicionada **uma**: o troféu da tela "Treino concluído!" entra com uma batida de ênfase
(`--animate-celebrar`, 0.45s, uma vez só). É o pagamento do esforço e acontece no fim do fluxo,
onde a pausa é bem-vinda.

### Decisões conscientes

- **Chips de filtro e botões `sm` ficam em 32-36px**, abaixo dos 44px de conforto mas bem acima do
  mínimo de 24px da WCAG 2.5.8. Subir todos mudaria a densidade da interface inteira; os alvos que
  importam no celular (navegação inferior, marcar série, ações principais) já têm 44px ou mais.
- **A vista de mês no celular mostra pontos, não texto.** Em 50px de largura, meia palavra informa
  menos que a contagem visual - o detalhe fica a um toque.
