import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { exigir } from "@/lib/env";

/**
 * Cliente Supabase com a service role key - contorna RLS e pode gerenciar
 * usuários do Auth diretamente (admin.createUser, admin.deleteUser, etc.).
 * Nunca importar isto em código que roda no browser.
 */
export function createAdminClient() {
  const url = exigir("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = exigir("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
