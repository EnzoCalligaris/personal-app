import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança aplicados a todas as respostas.
 *
 * A CSP fica restrita às diretivas que não dependem de nonce (o Next injeta
 * scripts inline próprios): elas bloqueiam clickjacking, injeção de `<base>`,
 * envio de formulário para outro domínio e plugins.
 */
const SEGURANCA = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // Ignorado pelo navegador em http://localhost; vale em produção.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Não anunciar o framework e a versão em toda resposta.
  poweredByHeader: false,

  /**
   * Empacota o servidor com só as dependências que ele usa, em
   * `.next/standalone` - é o que o Dockerfile copia. Não muda `next start`.
   *
   * É opt-in porque na Vercel esse modo quebra o build. Lá o build roda com um
   * adapter, e o Next chama o `onBuildComplete` dele **antes** de montar o
   * standalone - o adapter então procura `.next/next-server.js.nft.json`, que
   * aquele passo ainda não escreveu, e o build morre em ENOENT. O próprio Next
   * registra a incompatibilidade em build/index.js: "in the future
   * output: standalone might not be allowed if an adapter with onBuildComplete
   * is configured".
   *
   * Desligar por `process.env.VERCEL` seria o caminho óbvio, mas frágil: essa
   * variável só existe quando o projeto tem "Enable access to System
   * Environment Variables" marcado, e um deploy com ela desmarcada falharia de
   * novo, do mesmo jeito. Quem precisa de standalone é o Dockerfile, então é
   * ele quem pede - e qualquer outro build simplesmente não gera.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,

  async headers() {
    return [
      { source: "/:path*", headers: SEGURANCA },
      {
        // Resposta da API é sempre de um usuário específico: nunca deve ficar
        // em cache de navegador, proxy ou CDN.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
