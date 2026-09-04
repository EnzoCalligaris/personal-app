"use client";

import * as React from "react";
import Link from "next/link";
import {
  ActivityIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, SkeletonList } from "@/components/ui/loading";
import { Modal, ModalClose } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        {children}
      </div>
    </section>
  );
}

const palette = [
  { name: "primary", className: "bg-primary" },
  { name: "foreground", className: "bg-foreground" },
  { name: "muted", className: "bg-muted" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "destructive", className: "bg-destructive" },
  { name: "info", className: "bg-info" },
  { name: "chart-2", className: "bg-chart-2" },
];

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loadingDemo, setLoadingDemo] = React.useState(false);

  function simulateAction() {
    setLoadingDemo(true);
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1600)), {
      loading: "Salvando treino...",
      success: "Treino salvo com sucesso!",
      error: "Não foi possível salvar.",
    });
    setTimeout(() => setLoadingDemo(false), 1600);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" render={<Link href="/" />}>
              <ArrowLeftIcon />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Fundação visual"
          title="Design system"
          description="Componentes, cores e estados reutilizados em toda a plataforma."
        />

        <Section title="Cores" description="Tokens semânticos - adaptam-se ao tema claro e escuro.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {palette.map((color) => (
              <div key={color.name} className="flex flex-col gap-2">
                <div className={`h-16 rounded-xl ring-1 ring-border ${color.className}`} />
                <span className="font-mono text-xs text-muted-foreground">{color.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia" description="Outfit nos títulos, Geist no texto corrido.">
          <div className="flex flex-col gap-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight">Display 4xl</h1>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Título 2xl</h2>
            <h3 className="font-heading text-lg font-semibold tracking-tight">Subtítulo lg</h3>
            <p className="text-base">Corpo base — leitura confortável em telas pequenas.</p>
            <p className="text-sm text-muted-foreground">
              Texto de apoio sm — usado em descrições e legendas.
            </p>
            <p className="font-mono text-xs text-muted-foreground">mono xs — dados e códigos</p>
          </div>
        </Section>

        <Section title="Botões" description="Variantes, tamanhos e estados.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primário</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destrutivo</Button>
              <Button variant="destructive-soft">
                <TrashIcon />
                Excluir
              </Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg">
                <PlusIcon />
                Grande
              </Button>
              <Button size="default">Padrão</Button>
              <Button size="sm">Pequeno</Button>
              <Button size="xs">Mini</Button>
              <Button size="icon" aria-label="Buscar">
                <SearchIcon />
              </Button>
              <Button disabled>Desabilitado</Button>
              <Button disabled>
                <Spinner size="sm" />
                Carregando
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Badges" description="Status e categorias.">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Ativo</Badge>
            <Badge variant="secondary">Rascunho</Badge>
            <Badge variant="outline">Peito</Badge>
            <Badge variant="success">Concluído</Badge>
            <Badge variant="warning">Pendente</Badge>
            <Badge variant="destructive">Cancelado</Badge>
            <Badge variant="info">Reagendado</Badge>
          </div>
        </Section>

        <Section title="Campos" description="Inputs com alvo de toque de 44px no mobile.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-nome">Nome do exercício</Label>
              <Input id="ds-nome" placeholder="Supino reto" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-grupo">Grupo muscular</Label>
              <Select defaultValue="peito">
                <SelectTrigger id="ds-grupo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peito">Peito</SelectItem>
                  <SelectItem value="costas">Costas</SelectItem>
                  <SelectItem value="pernas">Pernas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-erro">Campo com erro</Label>
              <Input id="ds-erro" aria-invalid defaultValue="valor inválido" />
              <p className="text-sm text-destructive">Informe um valor válido.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-off">Desabilitado</Label>
              <Input id="ds-off" disabled defaultValue="Somente leitura" />
            </div>
          </div>
        </Section>

        <Section title="Avatares e abas">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary/15 text-primary">AL</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback className="bg-primary/15 text-primary">BR</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarFallback className="bg-primary/15 text-primary">CA</AvatarFallback>
              </Avatar>
              <AvatarGroup>
                <Avatar>
                  <AvatarFallback className="bg-muted">AN</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback className="bg-muted">JO</AvatarFallback>
                </Avatar>
                <AvatarGroupCount>+3</AvatarGroupCount>
              </AvatarGroup>
            </div>

            <Tabs defaultValue="semana">
              <TabsList>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
                <TabsTrigger value="ano">Ano</TabsTrigger>
              </TabsList>
              <TabsContent value="semana" className="pt-4 text-sm text-muted-foreground">
                Conteúdo da semana.
              </TabsContent>
              <TabsContent value="mes" className="pt-4 text-sm text-muted-foreground">
                Conteúdo do mês.
              </TabsContent>
              <TabsContent value="ano" className="pt-4 text-sm text-muted-foreground">
                Conteúdo do ano.
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        <Section title="Cards e métricas">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Alunos ativos"
                value={12}
                icon={UsersRoundIcon}
                trend={{ value: "+2 no mês", direction: "up" }}
              />
              <StatCard label="Treinos" value={48} icon={DumbbellIcon} tone="violet" />
              <StatCard label="Sessões hoje" value={5} icon={CalendarDaysIcon} tone="cyan" />
              <StatCard label="Avaliações" value={9} icon={ActivityIcon} tone="amber" loading />
            </div>

            <Card interactive>
              <CardHeader>
                <CardTitle>Card interativo</CardTitle>
                <CardDescription>
                  Passe o mouse: elevação sutil e leve deslocamento para indicar que é clicável.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Conteúdo do card com espaçamento consistente.
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Feedback" description="Toasts, modal e microinterações.">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success("Treino concluído!")}>
              Toast sucesso
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("Não foi possível salvar", { description: "Tente novamente." })
              }
            >
              Toast erro
            </Button>
            <Button variant="outline" onClick={() => toast.info("Novo agendamento recebido")}>
              Toast info
            </Button>
            <Button variant="outline" onClick={simulateAction} disabled={loadingDemo}>
              {loadingDemo ? <Spinner size="sm" /> : null}
              Toast de promessa
            </Button>
            <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
          </div>

          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title="Excluir exercício"
            description="Esta ação não pode ser desfeita. O exercício será removido dos treinos em que aparece."
            footer={
              <>
                <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setModalOpen(false);
                    toast.success("Exercício excluído");
                  }}
                >
                  <TrashIcon />
                  Excluir
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
                No mobile este modal vira um bottom sheet, com puxador e área de toque maior.
            </p>
          </Modal>
        </Section>

        <Section title="Estados" description="Carregando, vazio e erro.">
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-dashed border-border">
                <LoadingState message="Carregando treinos..." />
              </div>
              <SkeletonList items={3} />
            </div>

            <EmptyState
              icon={DumbbellIcon}
              title="Nenhum treino cadastrado"
              description="Crie o primeiro treino para este aluno e ele aparecerá aqui."
              action={
                <Button>
                  <PlusIcon />
                  Criar treino
                </Button>
              }
              secondaryAction={<Button variant="ghost">Saiba mais</Button>}
            />

            <ErrorState
              detail="Error: failed to fetch /api/treinos"
              onRetry={() => toast.info("Tentando novamente...")}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
