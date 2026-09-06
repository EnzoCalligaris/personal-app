"use client";

import * as React from "react";
import { MessageSquareTextIcon, QuoteIcon, TrendingUpIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataCalendario, formatarDataRelativa, formatarDiaPorExtenso, iniciais } from "@/lib/format";
import type { MeuFeedback, MeusFeedbacksResponse } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";

/**
 * Feedback do Personal: o comentário mais recente em destaque e o histórico
 * logo abaixo. Abrir a tela marca os comentários como lidos - é o que o
 * Personal vê do outro lado.
 */
export function MeusFeedbacks() {
  const { data, loading, error, refetch } = useApi<MeusFeedbacksResponse>("/api/aluno/feedbacks");

  // Marca como lido depois que a lista chega, uma vez por visita. O controle
  // fica em um ref: é só um efeito colateral, nada disso muda a tela.
  const jaMarcou = React.useRef(false);
  React.useEffect(() => {
    if (!data || jaMarcou.current || data.naoLidos === 0) return;

    jaMarcou.current = true;
    fetch("/api/aluno/feedbacks/lidos", { method: "POST" }).catch(() => {
      // Se falhar, o feedback continua como não lido - sem drama.
    });
  }, [data]);

  const maisRecente = data?.feedbacks[0] ?? null;
  const anteriores = data?.feedbacks.slice(1) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Do seu Personal"
        title="Feedback do Personal"
        description="Os comentários sobre seus treinos e avaliações, do mais recente para o mais antigo."
      />

      {error ? (
        <ErrorState title="Não foi possível carregar seus feedbacks" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <SkeletonList items={3} />
      ) : data.feedbacks.length === 0 ? (
        <EmptyState
          icon={MessageSquareTextIcon}
          title="Nenhum feedback ainda"
          description="Quando seu Personal comentar um treino ou uma avaliação sua, o recado aparece aqui."
        />
      ) : (
        <>
          {maisRecente ? <Destaque feedback={maisRecente} novo={!maisRecente.lido} /> : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Histórico</CardTitle>
              <CardDescription>
                {anteriores.length === 0
                  ? "Este é o seu primeiro feedback."
                  : `Mais ${anteriores.length} ${anteriores.length === 1 ? "comentário" : "comentários"} do seu Personal.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anteriores.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={MessageSquareTextIcon}
                  title="Sem comentários anteriores"
                  description="Os próximos feedbacks ficam guardados aqui."
                />
              ) : (
                <ol className="flex flex-col divide-y divide-border">
                  {anteriores.map((feedback) => (
                    <ItemFeedback key={feedback.id} feedback={feedback} />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Destaque({ feedback, novo }: { feedback: MeuFeedback; novo: boolean }) {
  return (
    <section
      aria-label="Comentário mais recente"
      className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-primary/18 via-primary/10 to-card p-5 shadow-soft ring-1 ring-primary/25 sm:p-6 dark:from-primary/22 dark:via-primary/12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Mais recente</Badge>
          {novo ? <Badge variant="info">Novo</Badge> : null}
          <span className="text-xs text-muted-foreground first-letter:uppercase">
            {formatarDiaPorExtenso(feedback.criadoEm)}
          </span>
        </div>

        <figure className="flex flex-col gap-3">
          <QuoteIcon className="size-6 text-primary/60" aria-hidden="true" />
          <blockquote className="text-base leading-relaxed text-pretty sm:text-lg">
            {feedback.texto}
          </blockquote>

          <figcaption className="flex items-center gap-2 pt-1">
            <Avatar size="sm">
              {feedback.personal?.avatarUrl ? (
                <AvatarImage src={feedback.personal.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
                {iniciais(feedback.personal?.nome ?? "PT")}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {feedback.personal?.nome ?? "Seu Personal"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatarDataRelativa(feedback.criadoEm)}
              </span>
            </div>
          </figcaption>
        </figure>

        {feedback.avaliacao ? (
          <Badge variant="secondary" className="w-fit gap-1">
            <TrendingUpIcon className="size-3" />
            Sobre a avaliação de {formatarDataCalendario(feedback.avaliacao.data)}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}

function ItemFeedback({ feedback }: { feedback: MeuFeedback }) {
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Avatar size="sm">
        {feedback.personal?.avatarUrl ? (
          <AvatarImage src={feedback.personal.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback className="bg-primary/15 text-[0.6rem] font-medium text-primary dark:bg-primary/20">
          {iniciais(feedback.personal?.nome ?? "PT")}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">
            {feedback.personal?.nome ?? "Seu Personal"}
          </span>
          <span className={cn("text-xs text-muted-foreground")}>
            {formatarDataRelativa(feedback.criadoEm)}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-pretty">{feedback.texto}</p>

        {feedback.avaliacao ? (
          <Badge variant="outline" className="w-fit gap-1">
            <TrendingUpIcon className="size-3" />
            Avaliação de {formatarDataCalendario(feedback.avaliacao.data)}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}
