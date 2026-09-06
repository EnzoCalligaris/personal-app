import "dotenv/config";

// Liga os eventos de consulta do Prisma antes de qualquer import do client,
// para os testes de orçamento poderem contar idas ao banco (ver
// `tests/desempenho.test.ts`). Sem isto o client nasce só com logs de erro.
process.env.PRISMA_LOG_QUERIES = "1";
