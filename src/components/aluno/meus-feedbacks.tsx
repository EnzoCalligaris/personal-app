"use client";

import { MessageSquareTextIcon, TrendingUpIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { formatarDataCalendario, formatarDataRelativa, iniciais } from "@/lib/format";
import type { MeuFeedback, MeusFeedbacksResponse } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";

/** Linha do tempo dos comentários que o Personal escreveu para o aluno. */
export function MeusFeedbacks() {
  const { data, loading, error, refetch } = useApi<MeusFeedbacksResponse>("/api/aluno/feedbacks");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Do seu Personal"
        title="Feedback"
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
        <ol className="flex flex-col gap-3">
          {data.feedbacks.map((feedback) => (
            <li key={feedback.id}>
              <CartaoFeedback feedback={feedback} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CartaoFeedback({ feedback }: { feedback: MeuFeedback }) {
  return (
    <article className="flex animate-fade-up gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border">
      <Avatar>
        {feedback.personal?.avatarUrl ? (
          <AvatarImage src={feedback.personal.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
          {iniciais(feedback.personal?.nome ?? "PT")}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{feedback.personal?.nome ?? "Seu Personal"}</span>
          <span className="text-xs text-muted-foreground">
            {formatarDataRelativa(feedback.criadoEm)}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-pretty">{feedback.texto}</p>

        {feedback.avaliacao ? (
          <Badge variant="secondary" className="w-fit gap-1">
            <TrendingUpIcon className="size-3" />
            Sobre a avaliação de {formatarDataCalendario(feedback.avaliacao.data)}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}
