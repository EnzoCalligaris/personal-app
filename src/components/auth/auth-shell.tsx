import Link from "next/link";
import { ActivityIcon, CalendarCheckIcon, DumbbellIcon } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const highlights = [
  {
    icon: DumbbellIcon,
    title: "Treinos personalizados",
    description: "Monte fichas por aluno e organize por dia da semana.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Agenda sem atrito",
    description: "Horários disponíveis, agendamento e reagendamento pelo aluno.",
  },
  {
    icon: ActivityIcon,
    title: "Evolução visível",
    description: "Bioimpedância, histórico e feedback em um só lugar.",
  },
];

/**
 * Casca das telas de autenticação: painel de marca no desktop e formulário
 * centralizado em qualquer tamanho de tela.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Painel de marca - só no desktop */}
      <aside className="relative hidden overflow-hidden bg-foreground p-10 text-background lg:flex lg:w-[46%] lg:flex-col lg:justify-between dark:bg-card dark:text-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-primary/10 blur-3xl"
        />

        <Brand href="/" className="relative z-10 text-background dark:text-foreground" />

        <div className="relative z-10 flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
              A plataforma que conecta seu treino ao resultado.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-background/70 dark:text-muted-foreground">
              Tudo o que Personal Trainer e aluno precisam: ficha de treino, agenda e evolução
              acompanhada de perto.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <item.icon className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="text-sm text-background/60 dark:text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-background/50 dark:text-muted-foreground">
          © {new Date().getFullYear()} Pulse Training
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-1 flex-col bg-background">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <Brand href="/" className="lg:hidden" />
          <ThemeToggle className="tap-target" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="flex w-full max-w-sm animate-fade-up flex-col gap-7">
            <header className="flex flex-col gap-2">
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-balance text-muted-foreground">
                {description}
              </p>
            </header>

            {children}

            {footer ? (
              <p className="text-center text-sm text-muted-foreground">{footer}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
