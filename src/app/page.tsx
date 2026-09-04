import Link from "next/link";
import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  DumbbellIcon,
  SparklesIcon,
} from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: DumbbellIcon,
    title: "Treinos que fazem sentido",
    description:
      "Monte fichas por aluno, organize por dia da semana e acompanhe cada execução registrada.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Agenda no piloto automático",
    description:
      "Você define os horários disponíveis; o aluno agenda, cancela e reagenda sozinho.",
  },
  {
    icon: ActivityIcon,
    title: "Evolução que se enxerga",
    description:
      "Bioimpedância, histórico e feedbacks reunidos em gráficos claros de progresso.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" render={<Link href="/login" />}>
              Entrar
            </Button>
            <Button size="sm" render={<Link href="/registro" />}>
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-7 px-4 py-16 text-center sm:px-6 sm:py-24">
            <Badge variant="outline" className="gap-1.5 py-1 pr-3 pl-2">
              <SparklesIcon className="size-3 text-primary" />
              Plataforma para Personal Trainers
            </Badge>

            <h1 className="max-w-3xl animate-fade-up font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Treinos, agenda e evolução dos seus alunos em{" "}
              <span className="text-primary">um só lugar</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:text-lg">
              Uma plataforma completa para acompanhar cada aluno de perto — do primeiro treino à
              avaliação de bioimpedância.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto" render={<Link href="/registro" />}>
                Começar agora
                <ArrowRightIcon />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                render={<Link href="/login" />}
              >
                Já tenho conta
              </Button>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} interactive>
                <CardHeader>
                  <span
                    aria-hidden="true"
                    className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/18"
                  >
                    <feature.icon className="size-5" />
                  </span>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Brand showWordmark={false} />
          <p>© {new Date().getFullYear()} Pulse Training</p>
          <Link href="/design-system" className="underline-offset-4 hover:text-foreground hover:underline">
            Design system
          </Link>
        </div>
      </footer>
    </div>
  );
}
