"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BadgeCheckIcon,
  CalendarClockIcon,
  ClockIcon,
  LogOutIcon,
  MailIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { formatarDataCalendario } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { RegrasAgendamento } from "@/types/agenda";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FotoDePerfil } from "@/components/ui/foto-de-perfil";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  HorariosDeTrabalhoEditor,
  RegrasDaAgendaEditor,
} from "@/components/personal/agenda/configuracoes";

type PerfilPersonal = {
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  cref: string | null;
  bio: string | null;
  membroDesde: string;
  resumo: { alunos: number; alunosAtivos: number; treinos: number };
};

// As mesmas regras do servidor (`src/lib/validations/perfil.ts`), para o erro
// aparecer no campo antes de a requisição sair.
const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  telefone: z
    .string()
    .refine(
      (valor) => valor.trim() === "" || /^[\d\s()+-]{8,20}$/.test(valor.trim()),
      "Use apenas números, espaços e os sinais ( ) + -."
    ),
  cref: z.string().max(30, "CREF muito longo."),
  bio: z.string().max(500, "Máximo de 500 caracteres."),
});

type Valores = z.infer<typeof formSchema>;

function paraFormulario(perfil: PerfilPersonal): Valores {
  return {
    nome: perfil.nome,
    telefone: perfil.telefone ?? "",
    cref: perfil.cref ?? "",
    bio: perfil.bio ?? "",
  };
}

/** Perfil e configurações do Personal, em duas abas. */
export function MeuPerfilPersonal() {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<PerfilPersonal>("/api/personal/perfil");

  const [perfil, setPerfil] = React.useState<PerfilPersonal | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [duracaoPadrao, setDuracaoPadrao] = React.useState(60);

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
      const res = await fetch("/api/personal/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: valores.nome.trim(),
          telefone: valores.telefone.trim() || null,
          cref: valores.cref.trim() || null,
          bio: valores.bio.trim() || null,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar seus dados.");
        return;
      }

      setPerfil(body as PerfilPersonal);
      reset(paraFormulario(body as PerfilPersonal));
      toast.success("Perfil atualizado.");
      router.refresh();
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
        <PageHeader eyebrow="Conta" title="Perfil e configurações" />
        <ErrorState title="Não foi possível carregar seu perfil" detail={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Perfil e configurações"
        description="Seus dados profissionais e as regras que governam a sua agenda."
        actions={
          <Button variant="outline" size="sm" onClick={sair}>
            <LogOutIcon />
            Sair
          </Button>
        }
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
              <FotoDePerfil
                nome={atual.nome}
                avatarUrl={atual.avatarUrl}
                onEnviada={(avatarUrl) => {
                  setPerfil({ ...atual, avatarUrl });
                  router.refresh();
                }}
              />

              <div className="flex min-w-48 flex-1 flex-col">
                <span className="font-heading text-lg font-semibold">{atual.nome}</span>
                <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <MailIcon className="size-3.5" aria-hidden="true" />
                  {atual.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  Personal desde {formatarDataCalendario(atual.membroDesde)}
                  {atual.cref ? ` · CREF ${atual.cref}` : ""}
                </span>
              </div>
            </CardContent>
          </Card>

          <section aria-label="Resumo" className="grid grid-cols-3 gap-3">
            <StatCard label="Alunos" value={atual.resumo.alunos} icon={UserRoundIcon} />
            <StatCard
              label="Ativos"
              value={atual.resumo.alunosAtivos}
              icon={BadgeCheckIcon}
              tone="violet"
            />
            <StatCard label="Treinos" value={atual.resumo.treinos} icon={ClockIcon} tone="cyan" />
          </section>

          <Tabs defaultValue="dados">
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="dados">Meus dados</TabsTrigger>
              <TabsTrigger value="agenda">Agenda e regras</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="pt-4">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Dados profissionais</CardTitle>
                  <CardDescription>
                    O e-mail de acesso não muda por aqui - ele identifica a sua conta.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="perfil-nome">Nome</Label>
                        <Input
                          id="perfil-nome"
                          {...register("nome")}
                          aria-invalid={!!errors.nome}
                        />
                        {errors.nome ? (
                          <span className="text-xs text-destructive">{errors.nome.message}</span>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="perfil-email">E-mail</Label>
                        <Input id="perfil-email" value={atual.email} readOnly disabled />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="perfil-telefone">
                          <PhoneIcon className="size-3.5" aria-hidden="true" />
                          Telefone
                        </Label>
                        <Input
                          id="perfil-telefone"
                          placeholder="(11) 90000-0000"
                          {...register("telefone")}
                          aria-invalid={!!errors.telefone}
                        />
                        {errors.telefone ? (
                          <span className="text-xs text-destructive">
                            {errors.telefone.message}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="perfil-cref">
                          <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                          CREF
                        </Label>
                        <Input
                          id="perfil-cref"
                          placeholder="000000-G/SP"
                          {...register("cref")}
                          aria-invalid={!!errors.cref}
                        />
                        {errors.cref ? (
                          <span className="text-xs text-destructive">{errors.cref.message}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="perfil-bio">Sobre você</Label>
                      <Textarea
                        id="perfil-bio"
                        rows={3}
                        maxLength={500}
                        placeholder="Especialidades, método de trabalho, formação..."
                        {...register("bio")}
                        aria-invalid={!!errors.bio}
                      />
                      {errors.bio ? (
                        <span className="text-xs text-destructive">{errors.bio.message}</span>
                      ) : null}
                    </div>

                    <Button
                      type="submit"
                      className="self-start"
                      disabled={salvando || !isDirty}
                    >
                      {salvando ? <Spinner /> : null}
                      Salvar alterações
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agenda" className="flex flex-col gap-4 pt-4">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Horários de trabalho</CardTitle>
                  <CardDescription>
                    O sistema gera os atendimentos disponíveis a partir destas faixas. O mesmo dia
                    aceita mais de uma (manhã e tarde).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HorariosDeTrabalhoEditor duracaoPadrao={duracaoPadrao} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle>
                    <span className="flex items-center gap-2">
                      <CalendarClockIcon className="size-4 text-muted-foreground" />
                      Regras de agendamento
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Duração padrão do treino, prazos mínimo e máximo para marcar e o prazo de
                    cancelamento. Salvo automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RegrasDaAgendaEditor
                    onRegras={(regras: RegrasAgendamento) =>
                      setDuracaoPadrao(regras.duracaoPadraoMin)
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
