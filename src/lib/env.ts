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
  NEXT_PUBLIC_SITE_URL:
    "o endereço público da própria aplicação, ex.: https://app.seudominio.com",
};

export const emProducao = process.env.NODE_ENV === "production";

/** Um caminho começa com "/" - e não com "//", que seria outro domínio. */
const CAMINHO_ABSOLUTO = /^\/(?!\/)/;

/**
 * Monta uma URL absoluta a partir do endereço público da aplicação.
 *
 * Serve para os links que **saem** da aplicação - hoje, o de recuperação de
 * senha. Esses links não podem ser montados a partir da requisição: o `Host`
 * vem do cliente, então quem pedisse a recuperação com um `Host` forjado
 * receberia no próprio e-mail um link apontando para o domínio do atacante,
 * com um token válido dentro. A origem confiável é configuração, não algo que
 * a requisição informa.
 *
 * A junção é previsível: barra sobrando no fim da variável não vira `//`, e um
 * caminho base configurado (`https://site.com/app`) é preservado.
 */
export function urlPublica(caminho: string): string {
  if (!CAMINHO_ABSOLUTO.test(caminho)) {
    throw new Error(`Caminho inválido para urlPublica: "${caminho}". Comece com "/".`);
  }

  const bruto = exigir("NEXT_PUBLIC_SITE_URL").trim();

  let base: URL;
  try {
    base = new URL(bruto);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL não é uma URL absoluta: "${bruto}".` +
        " Use algo como https://app.seudominio.com."
    );
  }

  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL precisa ser http ou https, e veio "${base.protocol}".`
    );
  }

  const prefixo = base.pathname.replace(/\/+$/, "");
  return `${base.origin}${prefixo}${caminho}`;
}

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
