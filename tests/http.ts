/** Helpers de HTTP para os testes que batem no servidor Next real (porta do global-setup). */

export const BASE_URL = "http://127.0.0.1:3100";

/** Senha usada por todos os usuários criados pelas factories. */
export const SENHA = "Teste@12345";

export function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export async function login(email: string, password: string = SENHA) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { status: res.status, body, cookie: cookieHeaderFrom(res) };
}

export function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
}
