import { createClient } from "@supabase/supabase-js";

// Client admin construído localmente nos testes (não importa
// src/lib/supabase/admin.ts porque esse módulo usa `server-only`, que só
// funciona dentro do bundler do Next.js).
export function createTestAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
