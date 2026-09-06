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
   */
  output: "standalone",

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
