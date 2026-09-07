import "dotenv/config";

// Liga os eventos de consulta do Prisma antes de qualquer import do client,
// para os testes de orçamento poderem contar idas ao banco (ver
// `tests/desempenho.test.ts`). Sem isto o client nasce só com logs de erro.
process.env.PRISMA_LOG_QUERIES = "1";

/**
 * Fuso do processo de teste.
 *
 * O Windows ignora `TZ` com nome IANA na partida do Node (`TZ=Asia/Tokyo npx
 * vitest run` roda no fuso da máquina, sem avisar), mas honra a atribuição em
 * tempo de execução. `FUSO_TESTE=Asia/Tokyo npm test` passa a valer em
 * qualquer sistema - é assim que se prova que a aplicação não depende do
 * relógio de quem roda a suíte.
 */
if (process.env.FUSO_TESTE) {
  process.env.TZ = process.env.FUSO_TESTE;
}
