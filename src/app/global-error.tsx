"use client";

import { useEffect } from "react";

/**
 * Último anteparo: pega erro lançado no próprio layout raiz, onde o
 * `error.tsx` não chega (ele renderiza *dentro* do layout). Por substituir o
 * documento inteiro, precisa trazer as próprias tags `html` e `body` - e não
 * pode contar com nada do layout, por isso o estilo vai embutido.
 *
 * O que aparece para a pessoa é uma mensagem curta e o id do erro; a causa
 * fica no log do servidor, associada a esse mesmo id.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na raiz da aplicação:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f7f8f9",
          color: "#16181d",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Alguma coisa saiu do lugar
          </h1>
          <p style={{ margin: "0 0 1.25rem", color: "#5b6270", lineHeight: 1.5 }}>
            Não foi possível carregar a aplicação. Tente de novo - se continuar, avise o suporte
            com o identificador abaixo.
          </p>
          {error.digest ? (
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.8rem", color: "#8a909c" }}>
              ID do erro: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#16181d",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
