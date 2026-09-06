/**
 * Leitura das variáveis de ambiente com erro que diz o que fazer.
 *
 * Sem isto, uma variável faltando em produção vira um erro obscuro dentro de
 * uma requisição qualquer ("Cannot read properties of undefined") ou, pior,
 * um caminho que silenciosamente não faz nada. A regra aqui é falhar alto e
 * cedo, apontando a variável e onde pegar o valor.
 *
 * Nenhum valor é embutido no código: tudo vem do ambiente (ver `.env.example`).
 */

const ONDE_ENCONTRAR: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase → Settings → API → Project URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase → Settings → API → anon public",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase → Settings → API → service_role (secreta)",
  DATABASE_URL: "Supabase → Settings → Database → Connection pooling (porta 6543)",
  DIRECT_URL: "Supabase → Settings → Database → conexão direta (porta 5432)",
};

export const emProducao = process.env.NODE_ENV === "production";

/** Valor obrigatório: sem ele a aplicação não sobe. */
export function exigir(nome: keyof typeof ONDE_ENCONTRAR | string): string {
  const valor = process.env[nome];
  if (valor) return valor;

  const dica = ONDE_ENCONTRAR[nome];
  throw new Error(
    `Variável de ambiente ${nome} não definida.` +
      (dica ? ` Pegue o valor em: ${dica}.` : "") +
      " Veja .env.example."
  );
}

/**
 * Valor opcional em desenvolvimento, obrigatório em produção. É o caso das
 * chaves do Supabase: dá para mexer só no banco localmente sem autenticação,
 * mas subir assim em produção deixaria as páginas sem proteção.
 */
export function exigirEmProducao(nome: string): string | undefined {
  const valor = process.env[nome];
  if (valor) return valor;
  if (emProducao) return exigir(nome);
  return undefined;
}
