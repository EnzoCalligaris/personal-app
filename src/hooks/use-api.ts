"use client";

import * as React from "react";

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * GET em um endpoint da própria aplicação, com estados de carregamento e erro
 * e possibilidade de tentar de novo. A requisição é cancelada se o componente
 * desmontar ou se um novo `refetch` começar.
 */
export function useApi<T>(url: string) {
  const [state, setState] = React.useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetch(url, { signal: controller.signal, credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Falha na requisição (${res.status}).`);
        }
        return (await res.json()) as T;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Erro inesperado.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, attempt]);

  const refetch = React.useCallback(() => {
    setState({ data: null, loading: true, error: null });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, refetch };
}
