"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, DumbbellIcon, PlusIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel, formatarDataRelativa } from "@/lib/format";
import type { TreinoListResponse } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonList } from "@/components/ui/loading";
import { TreinoFormModal } from "@/components/personal/treinos/treino-form-modal";

/** Treinos deste aluno, exibidos na aba "Treinos" da ficha. */
export function AlunoTreinosTab({ aluno }: { aluno: { id: string; nome: string } }) {
  const router = useRouter();
  const [criando, setCriando] = React.useState(false);
  const { data, loading, error, refetch } = useApi<TreinoListResponse>(
    `/api/personal/treinos?alunoId=${aluno.id}&status=TODOS`
  );

  if (loading) return <SkeletonList items={3} />;

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar os treinos"
        description="Houve um problema ao buscar os treinos deste aluno."
        detail={error}
        onRetry={refetch}
      />
    );
  }

  const treinos = data?.treinos ?? [];

  return (
    <div className="flex flex-col gap-4">
      {treinos.length === 0 ? (
        <EmptyState
          icon={DumbbellIcon}
          title="Nenhum treino para este aluno"
          description="Monte a primeira ficha organizando os exercícios por dia da semana."
          action={
            <Button onClick={() => setCriando(true)}>
              <PlusIcon />
              Criar treino
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {treinos.length} treino(s) vinculado(s) a {aluno.nome.split(" ")[0]}.
            </p>
            <Button size="sm" onClick={() => setCriando(true)}>
              <PlusIcon />
              Novo treino
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {treinos.map((treino) => (
              <li key={treino.id}>
                <Link
                  href={`/personal/treinos/${treino.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all",
                    "hover:-translate-y-0.5 hover:shadow-soft",
                    !treino.ativo && "opacity-70"
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/18">
                    <DumbbellIcon className="size-5" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{treino.nome}</span>
                      <Badge variant="outline">{diaSemanaLabel(treino.diaSemana)}</Badge>
                      {!treino.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {treino.totalExercicios} exercício(s)
                      {treino.grupos.length ? ` · ${treino.grupos.join(", ")}` : ""}
                      {treino.ultimaExecucao
                        ? ` · executado ${formatarDataRelativa(treino.ultimaExecucao)}`
                        : ""}
                    </span>
                  </div>

                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <TreinoFormModal
        open={criando}
        onOpenChange={setCriando}
        alunoFixo={aluno}
        onSaved={(treino) => router.push(`/personal/treinos/${treino.id}`)}
      />
    </div>
  );
}
