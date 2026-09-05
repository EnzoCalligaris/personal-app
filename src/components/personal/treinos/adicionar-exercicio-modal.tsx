"use client";

import * as React from "react";
import { CheckIcon, SearchIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { ExercicioListResponse } from "@/types/exercicio";
import type { TreinoDetalhe } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function AdicionarExercicioModal({
  open,
  onOpenChange,
  treinoId,
  onAdicionado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treinoId: string;
  onAdicionado: (treino: TreinoDetalhe) => void;
}) {
  const [busca, setBusca] = React.useState("");
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  const [series, setSeries] = React.useState("3");
  const [repeticoes, setRepeticoes] = React.useState("10-12");
  const [carga, setCarga] = React.useState("");
  const [descanso, setDescanso] = React.useState("60");
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const url = React.useMemo(() => {
    const params = new URLSearchParams({ status: "ATIVOS" });
    if (buscaAplicada) params.set("q", buscaAplicada);
    return open ? `/api/personal/exercicios?${params.toString()}` : null;
  }, [buscaAplicada, open]);

  const { data, loading } = useApi<ExercicioListResponse>(url);

  async function adicionar() {
    if (!selecionado) {
      toast.error("Selecione um exercício da biblioteca.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(`/api/personal/treinos/${treinoId}/exercicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercicioId: selecionado,
          series: Number(series),
          repeticoes: repeticoes.trim(),
          carga: carga.trim() || null,
          descansoSeg: descanso ? Number(descanso) : null,
        }),
      });
      const treino = await res.json();

      if (!res.ok) {
        toast.error(treino.error ?? "Não foi possível adicionar o exercício.");
        return;
      }

      toast.success("Exercício adicionado ao treino!");
      onAdicionado(treino as TreinoDetalhe);
      setSelecionado(null);
      setCarga("");
      onOpenChange(false);
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Adicionar exercício"
      description="Escolha um exercício da sua biblioteca e defina séries, repetições e carga."
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button onClick={adicionar} disabled={salvando || !selecionado}>
            {salvando ? <Spinner size="sm" /> : null}
            Adicionar ao treino
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar na biblioteca"
            aria-label="Buscar exercício"
            className="pl-10"
          />
        </div>

        <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
          {loading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (data?.exercicios.length ?? 0) === 0 ? (
            <EmptyState
              size="sm"
              className="border-none bg-transparent"
              title="Nenhum exercício encontrado"
              description="Cadastre exercícios na biblioteca para montar os treinos."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data!.exercicios.map((exercicio) => {
                const ativo = selecionado === exercicio.id;
                return (
                  <li key={exercicio.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionado(exercicio.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        ativo ? "bg-primary/10 dark:bg-primary/15" : "hover:bg-muted/60"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{exercicio.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {exercicio.grupoMuscular}
                        </span>
                      </span>
                      {ativo ? (
                        <Badge>
                          <CheckIcon />
                          Selecionado
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-series">Séries</Label>
            <Input
              id="item-series"
              type="number"
              inputMode="numeric"
              min={1}
              value={series}
              onChange={(event) => setSeries(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-reps">Repetições</Label>
            <Input
              id="item-reps"
              value={repeticoes}
              onChange={(event) => setRepeticoes(event.target.value)}
              placeholder="8-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-carga">Carga</Label>
            <Input
              id="item-carga"
              value={carga}
              onChange={(event) => setCarga(event.target.value)}
              placeholder="40kg"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-descanso">Descanso (s)</Label>
            <Input
              id="item-descanso"
              type="number"
              inputMode="numeric"
              min={0}
              value={descanso}
              onChange={(event) => setDescanso(event.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
