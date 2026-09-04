"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro inesperado:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <ErrorState
        className="max-w-md"
        detail={error.digest ? `ID do erro: ${error.digest}` : undefined}
        onRetry={reset}
      />
    </div>
  );
}
