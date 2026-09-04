import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // O CLI (migrate/introspect) usa a conexão direta (bypassa o pooler do
  // Supabase em produção). O runtime da aplicação usa DATABASE_URL (pooled)
  // via driver adapter em src/lib/prisma.ts.
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
