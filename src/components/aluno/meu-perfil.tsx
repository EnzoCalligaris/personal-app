"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDaysIcon, LogOutIcon, MailIcon, PhoneIcon, RulerIcon, TargetIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { formatarDataCalendario, iniciais } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { MeuPerfil as MeuPerfilData } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

// Os campos chegam do input como string; a conversão para o payload acontece
// em `paraPayload` e a API valida de novo com `editarMeuPerfilSchema`.
const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  telefone: z.string(),
  dataNascimento: z.string(),
  altura: z.string(),
  objetivo: z.string(),
});

type Valores = z.infer<typeof formSchema>;

function paraFormulario(perfil: MeuPerfilData): Valores {
  return {
    nome: perfil.nome,
    telefone: perfil.telefone ?? "",
    dataNascimento: perfil.dataNascimento ? perfil.dataNascimento.slice(0, 10) : "",
    altura: perfil.altura ? String(perfil.altura) : "",
    objetivo: perfil.objetivo ?? "",
  };
}

function paraPayload(valores: Valores) {
  return {
    nome: valores.nome.trim(),
    telefone: valores.telefone.trim() || null,
    dataNascimento: valores.dataNascimento || null,
    altura: valores.altura ? Number(valores.altura) : null,
    objetivo: valores.objetivo.trim() || null,
  };
}

export function MeuPerfil() {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<MeuPerfilData>("/api/aluno/perfil");
  const [perfil, setPerfil] = React.useState<MeuPerfilData | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const atual = perfil ?? data;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Valores>({
    resolver: zodResolver(formSchema),
    values: atual ? paraFormulario(atual) : undefined,
  });

  async function salvar(valores: Valores) {
    setSalvando(true);
    try {
      const res = await fetch("/api/aluno/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paraPayload(valores)),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar seus dados.");
        return;
      }

      setPerfil(body as MeuPerfilData);
      reset(paraFormulario(body as MeuPerfilData));
      toast.success("Perfil atualizado.");
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      toast.success("Sessão encerrada");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair", { description: "Tente novamente." });
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Conta" title="Meu perfil" />
        <ErrorState title="Não foi possível carregar seu perfil" detail={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Seus dados de contato e o objetivo que orienta os treinos."
      />

      {loading || !atual ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4">
              <Avatar size="lg">
                {atual.avatarUrl ? <AvatarImage src={atual.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary/15 font-medium text-primary dark:bg-primary/20">
                  {iniciais(atual.nome)}
                </AvatarFallback>
              </Avatar>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-heading text-lg font-semibold">{atual.nome}</span>
                <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <MailIcon className="size-3.5" aria-hidden="true" />
                  {atual.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  Aluno desde {formatarDataCalendario(atual.membroDesde)}
                </span>
              </div>

              <Button variant="outline" size="sm" onClick={sair}>
                <LogOutIcon />
                Sair
              </Button>
            </CardContent>
          </Card>

          {atual.personal ? (
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  {atual.personal.avatarUrl ? (
                    <AvatarImage src={atual.personal.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
                    {iniciais(atual.personal.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{atual.personal.nome}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    seu Personal Trainer · {atual.personal.email}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Meus dados</CardTitle>
              <CardDescription>
                O e-mail de acesso é gerenciado pelo seu Personal e não pode ser alterado aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" {...register("nome")} aria-invalid={!!errors.nome} />
                  {errors.nome ? (
                    <span className="text-xs text-destructive">{errors.nome.message}</span>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="telefone">
                      <PhoneIcon className="size-3.5" aria-hidden="true" />
                      Telefone
                    </Label>
                    <Input id="telefone" placeholder="(11) 90000-0000" {...register("telefone")} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dataNascimento">
                      <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                      Data de nascimento
                    </Label>
                    <Input id="dataNascimento" type="date" {...register("dataNascimento")} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="altura">
                      <RulerIcon className="size-3.5" aria-hidden="true" />
                      Altura (cm)
                    </Label>
                    <Input id="altura" type="number" placeholder="168" {...register("altura")} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="objetivo">
                      <TargetIcon className="size-3.5" aria-hidden="true" />
                      Objetivo
                    </Label>
                    <Input
                      id="objetivo"
                      placeholder="Hipertrofia, emagrecimento..."
                      {...register("objetivo")}
                    />
                  </div>
                </div>

                <Button type="submit" className="self-start" disabled={salvando || !isDirty}>
                  {salvando ? <Spinner /> : null}
                  Salvar alterações
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
