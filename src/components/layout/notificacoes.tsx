"use client";

import * as React from "react";
import Link from "next/link";
import {
  ActivityIcon,
  BellIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  DumbbellIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataRelativa } from "@/lib/format";
import type { NotificacoesResponse, TipoNotificacao } from "@/types/feedback";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const ICONE: Record<TipoNotificacao, LucideIcon> = {
  NOVO_TREINO: DumbbellIcon,
  AGENDAMENTO_CONFIRMADO: CalendarDaysIcon,
  AGENDAMENTO_CANCELADO: CalendarDaysIcon,
  AGENDAMENTO_REAGENDADO: CalendarDaysIcon,
  NOVA_AVALIACAO: ActivityIcon,
  NOVO_FEEDBACK: MessageSquareTextIcon,
  LEMBRETE: BellIcon,
};

/**
 * Campainha da barra superior: as notificações internas do usuário. A lista é
 * buscada ao abrir - não fica batendo na API em segundo plano.
 */
export function Notificacoes() {
  const [aberto, setAberto] = React.useState(false);
  const [versao, setVersao] = React.useState(0);

  // Uma primeira leitura mostra o marcador; as seguintes acontecem ao abrir.
  const { data, loading } = useApi<NotificacoesResponse>(
    `/api/notificacoes?v=${versao}`
  );

  const naoLidas = data?.naoLidas ?? 0;

  async function marcarTodas() {
    await fetch("/api/notificacoes/lidas", { method: "POST" });
    setVersao((valor) => valor + 1);
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(valor) => {
        setAberto(valor);
        if (valor) setVersao((atual) => atual + 1);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"
            }
            className="relative text-muted-foreground hover:text-foreground"
          >
            <BellIcon />
            {naoLidas > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            ) : null}
          </Button>
        }
      />

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <span className="text-sm font-medium">
            Notificações
            {naoLidas > 0 ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                {naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}
              </span>
            ) : null}
          </span>
          {naoLidas > 0 ? (
            <Button variant="ghost" size="xs" onClick={marcarTodas}>
              <CheckCheckIcon />
              Marcar lidas
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && !data ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, indice) => (
                <Skeleton key={indice} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : !data || data.notificacoes.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nada por aqui ainda.
            </p>
          ) : (
            <ul className="flex flex-col">
              {data.notificacoes.map((notificacao) => {
                const Icone = ICONE[notificacao.tipo] ?? BellIcon;

                const conteudo = (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        notificacao.lida
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/12 text-primary dark:bg-primary/18"
                      )}
                    >
                      <Icone className="size-4" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{notificacao.titulo}</span>
                        {!notificacao.lida ? (
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                          />
                        ) : null}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notificacao.mensagem}
                      </span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {formatarDataRelativa(notificacao.criadaEm)}
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={notificacao.id} className="border-b border-border last:border-0">
                    {notificacao.link ? (
                      <Link
                        href={notificacao.link}
                        onClick={() => setAberto(false)}
                        className="flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="flex gap-2.5 px-3 py-2.5">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
