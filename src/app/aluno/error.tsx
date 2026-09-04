"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/error-state";

export default function AlunoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na área do Aluno:", error);
  }, [error]);

  return (
    <ErrorState
      title="Não foi possível carregar esta página"
      description="Ocorreu um erro inesperado ao buscar seus dados. Tente novamente."
      detail={error.digest ? `ID do erro: ${error.digest}` : undefined}
      onRetry={reset}
    />
  );
}
