import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "lucide-react";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function PersonalOverviewPage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "PERSONAL" || !ctx.personalProfileId) {
    redirect("/login");
  }

  const alunos = await prisma.alunoProfile.findMany({
    where: { personalId: ctx.personalProfileId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const primeiroNome = ctx.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${primeiroNome}`}
        description="Acompanhe seus alunos e o que está acontecendo hoje."
        actions={
          <Button render={<Link href="/personal/alunos" />}>
            <UserPlusIcon />
            Novo aluno
          </Button>
        }
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Alunos ativos"
          value={alunos.length}
          icon={UsersRoundIcon}
          tone="primary"
        />
        <StatCard label="Treinos ativos" value="--" icon={DumbbellIcon} tone="violet" />
        <StatCard label="Sessões hoje" value="--" icon={CalendarDaysIcon} tone="cyan" />
        <StatCard label="Avaliações no mês" value="--" icon={ActivityIcon} tone="amber" />
      </section>

      <p className="-mt-2 text-xs text-muted-foreground">
        Indicadores marcados com <span className="font-medium text-foreground">--</span> serão
        preenchidos conforme as próximas fases (treinos, agenda e avaliações) forem implementadas.
      </p>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Meus alunos</CardTitle>
          <CardDescription>Alunos vinculados à sua conta.</CardDescription>
          {alunos.length > 0 ? (
            <CardAction>
              <Button variant="ghost" size="sm" render={<Link href="/personal/alunos" />}>
                Ver todos
                <ArrowRightIcon />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent>
          {alunos.length === 0 ? (
            <EmptyState
              size="sm"
              icon={UsersRoundIcon}
              title="Nenhum aluno vinculado ainda"
              description="Quando você cadastrar alunos, eles aparecerão aqui com o resumo de treinos e avaliações."
              action={
                <Button size="sm" render={<Link href="/personal/alunos" />}>
                  <UserPlusIcon />
                  Cadastrar aluno
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {alunos.map((aluno) => (
                <li key={aluno.id}>
                  <div className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-muted/50">
                    <Avatar>
                      <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary dark:bg-primary/20">
                        {initials(aluno.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{aluno.user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {aluno.user.email}
                      </span>
                    </div>
                    <Badge variant="success" className="hidden sm:inline-flex">
                      Ativo
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
