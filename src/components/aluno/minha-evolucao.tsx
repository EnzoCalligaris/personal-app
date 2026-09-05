"use client";

import * as React from "react";
import { ActivityIcon, RulerIcon, TrendingUpIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataCalendario, formatarVariacao } from "@/lib/format";
import type { MinhaAvaliacao, MinhaEvolucaoResponse, VariacaoMetrica } from "@/types/aluno-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EvolucaoDosTreinos } from "@/components/aluno/evolucao-treinos";
import { GraficoEvolucao } from "@/components/aluno/grafico-evolucao";

type ChaveMetrica = "peso" | "percentualGordura" | "massaMagra" | "imc";

const METRICAS: {
  chave: ChaveMetrica;
  rotulo: string;
  unidade: string;
  /** Se cair, é sinal de progresso (para colorir a variação). */
  menorMelhor: boolean;
}[] = [
  { chave: "peso", rotulo: "Peso", unidade: " kg", menorMelhor: true },
  { chave: "percentualGordura", rotulo: "Gordura", unidade: "%", menorMelhor: true },
  { chave: "massaMagra", rotulo: "Massa magra", unidade: " kg", menorMelhor: false },
  { chave: "imc", rotulo: "IMC", unidade: "", menorMelhor: true },
];

/** A área de evolução do aluno: como os treinos e o corpo vêm mudando. */
export function MinhaEvolucao() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Seu progresso"
        title="Evolução"
        description="Como seus treinos e seu corpo estão evoluindo ao longo do tempo."
      />

      <Tabs defaultValue="treinos">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="treinos">Treinos</TabsTrigger>
          <TabsTrigger value="corpo">Corpo</TabsTrigger>
        </TabsList>

        <TabsContent value="treinos" className="pt-4">
          <EvolucaoDosTreinos />
        </TabsContent>

        <TabsContent value="corpo" className="pt-4">
          <EvolucaoCorporal />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Bioimpedância: peso, gordura, massa magra, IMC e medidas. */
function EvolucaoCorporal() {
  const { data, loading, error, refetch } = useApi<MinhaEvolucaoResponse>("/api/aluno/evolucao");
  const [metrica, setMetrica] = React.useState<ChaveMetrica>("peso");

  const disponiveis = METRICAS.filter((item) => data?.[item.chave] != null);
  const selecionada = disponiveis.find((item) => item.chave === metrica) ?? disponiveis[0];

  const pontos = (data?.avaliacoes ?? [])
    .filter((avaliacao) => selecionada && avaliacao[selecionada.chave] !== null)
    .map((avaliacao) => ({
      data: avaliacao.data.slice(0, 10),
      valor: avaliacao[selecionada!.chave]!,
    }));

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <ErrorState title="Não foi possível carregar sua evolução" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, indice) => (
              <Skeleton key={indice} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : data.avaliacoes.length === 0 ? (
        <EmptyState
          icon={TrendingUpIcon}
          title="Nenhuma avaliação registrada"
          description="Depois da sua primeira bioimpedância, seus números e a evolução deles aparecem aqui."
        />
      ) : (
        <>
          <section aria-label="Números atuais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METRICAS.map((item) => (
              <CartaoMetrica
                key={item.chave}
                rotulo={item.rotulo}
                unidade={item.unidade}
                dado={data[item.chave]}
                menorMelhor={item.menorMelhor}
              />
            ))}
          </section>

          <Card>
            <CardHeader className="border-b max-md:grid-cols-1!">
              <CardTitle>Como você evoluiu</CardTitle>
              <CardDescription>
                {data.avaliacoes.length === 1
                  ? "Com mais de uma avaliação, a linha mostra a tendência."
                  : `${data.avaliacoes.length} avaliações registradas.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {disponiveis.length > 1 ? (
                <div
                  role="tablist"
                  aria-label="Métrica do gráfico"
                  className="flex flex-wrap gap-1.5"
                >
                  {disponiveis.map((item) => (
                    <button
                      key={item.chave}
                      role="tab"
                      type="button"
                      aria-selected={selecionada?.chave === item.chave}
                      onClick={() => setMetrica(item.chave)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                        selecionada?.chave === item.chave
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.rotulo}
                    </button>
                  ))}
                </div>
              ) : null}

              {selecionada && pontos.length ? (
                <GraficoEvolucao
                  pontos={pontos}
                  unidade={selecionada.unidade}
                  rotulo={selecionada.rotulo}
                />
              ) : (
                <EmptyState
                  size="sm"
                  icon={ActivityIcon}
                  title="Sem dados para esta métrica"
                  description="Suas avaliações ainda não registraram este número."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Histórico de avaliações</CardTitle>
              <CardDescription>Da mais recente para a mais antiga.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {[...data.avaliacoes].reverse().map((avaliacao) => (
                  <ItemAvaliacao key={avaliacao.id} avaliacao={avaliacao} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function CartaoMetrica({
  rotulo,
  unidade,
  dado,
  menorMelhor,
}: {
  rotulo: string;
  unidade: string;
  dado: VariacaoMetrica | null;
  menorMelhor: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border">
      <span className="text-sm font-medium text-muted-foreground">{rotulo}</span>
      <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
        {dado ? (
          <>
            {dado.atual.toLocaleString("pt-BR")}
            <span className="text-sm font-normal text-muted-foreground">{unidade}</span>
          </>
        ) : (
          "--"
        )}
      </span>
      {dado?.variacao != null ? (
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            dado.variacao === 0
              ? "bg-muted text-muted-foreground"
              : dado.variacao < 0 === menorMelhor
                ? "bg-success/12 text-success dark:bg-success/18"
                : "bg-warning/15 text-warning dark:bg-warning/20"
          )}
        >
          {formatarVariacao(dado.variacao)}
          {unidade.trim()}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {dado ? "primeira medição" : "sem registro"}
        </span>
      )}
    </div>
  );
}

/** As medidas vêm como chave livre no JSON; estas ganham um rótulo bonito. */
const ROTULO_MEDIDA: Record<string, string> = {
  peito: "Peito",
  cintura: "Cintura",
  quadril: "Quadril",
  braco: "Braço",
  antebraco: "Antebraço",
  coxa: "Coxa",
  panturrilha: "Panturrilha",
  ombros: "Ombros",
};

function ItemAvaliacao({ avaliacao }: { avaliacao: MinhaAvaliacao }) {
  const numeros = [
    avaliacao.peso !== null ? `${avaliacao.peso.toLocaleString("pt-BR")} kg` : null,
    avaliacao.percentualGordura !== null ? `${avaliacao.percentualGordura}% gordura` : null,
    avaliacao.massaMagra !== null ? `${avaliacao.massaMagra} kg magra` : null,
    avaliacao.imc !== null ? `IMC ${avaliacao.imc}` : null,
  ].filter(Boolean) as string[];

  const medidas = avaliacao.medidas ? Object.entries(avaliacao.medidas) : [];

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-sm font-medium">{formatarDataCalendario(avaliacao.data)}</span>
        <span className="text-xs text-muted-foreground">{numeros.join(" · ")}</span>
      </div>

      {medidas.length ? (
        <div className="flex flex-wrap gap-1.5">
          {medidas.map(([nome, valor]) => (
            <Badge key={nome} variant="outline" className="gap-1">
              <RulerIcon className="size-3" />
              {ROTULO_MEDIDA[nome] ?? nome} {valor} cm
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}
