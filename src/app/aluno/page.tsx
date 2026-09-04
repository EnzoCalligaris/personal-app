import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ActivityIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  FlameIcon,
  UserRoundIcon,
} from "lucide-react";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function AlunoHomePage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "ALUNO" || !ctx.alunoProfileId) {
    redirect("/login");
  }

  const perfil = await prisma.alunoProfile.findUnique({
    where: { id: ctx.alunoProfileId },
    include: { personal: { include: { user: { select: { name: true, email: true } } } } },
  });

  const primeiroNome = ctx.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Seu dia"
        title={`Bora treinar, ${primeiroNome}?`}
        description="Acompanhe seu treino, seus horários e sua evolução em um só lugar."
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Treinos na semana" value="--" icon={DumbbellIcon} tone="primary" />
        <StatCard label="Sequência" value="--" icon={FlameIcon} tone="amber" />
        <StatCard label="Próxima sessão" value="--" icon={CalendarDaysIcon} tone="cyan" />
        <StatCard label="Última avaliação" value="--" icon={ActivityIcon} tone="violet" />
      </section>

      <p className="-mt-2 text-xs text-muted-foreground">
        Indicadores marcados com <span className="font-medium text-foreground">--</span> serão
        preenchidos quando as fases de treinos, agenda e avaliações forem implementadas.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Treino de hoje</CardTitle>
            <CardDescription>O que seu Personal preparou para você.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              size="sm"
              icon={DumbbellIcon}
              title="Nenhum treino programado para hoje"
              description="Quando seu Personal montar sua ficha, o treino do dia aparece aqui pronto para execução."
              action={
                <Button size="sm" variant="outline" render={<Link href="/aluno/treinos" />}>
                  Ver meus treinos
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Meu Personal</CardTitle>
            <CardDescription>Quem acompanha seu treino.</CardDescription>
          </CardHeader>
          <CardContent>
            {perfil?.personal ? (
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary/15 font-medium text-primary dark:bg-primary/20">
                    {initials(perfil.personal.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{perfil.personal.user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {perfil.personal.user.email}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                size="sm"
                icon={UserRoundIcon}
                title="Sem Personal vinculado"
                description="Assim que um Personal Trainer vincular você à conta dele, ele aparecerá aqui."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
