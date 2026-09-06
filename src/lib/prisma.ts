import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { exigir } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: exigir("DATABASE_URL") });

/**
 * Com `PRISMA_LOG_QUERIES=1`, cada consulta vira um evento - é assim que os
 * testes de orçamento contam quantas idas ao banco um endpoint faz e pegam
 * um N+1 antes de ele chegar em produção.
 */
const contarConsultas = process.env.PRISMA_LOG_QUERIES === "1";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: contarConsultas
      ? [{ emit: "event", level: "query" }, "warn", "error"]
      : process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
