import type { CookieOptions } from "@supabase/ssr";

/**
 * Endurece os cookies de sessão emitidos pelo Supabase.
 *
 * O cookie guarda o access token **e** o refresh token, então precisa ficar
 * fora do alcance de JavaScript: com `httpOnly`, um eventual XSS não vira
 * roubo de sessão de longa duração. Nada no navegador lê a sessão pelo
 * cookie - a aplicação inteira fala com as rotas de API, que resolvem o
 * usuário no servidor.
 *
 * `secure` só entra em produção porque em desenvolvimento o app roda em
 * http://localhost.
 */
export function cookieDeSessao(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: options.sameSite ?? "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
