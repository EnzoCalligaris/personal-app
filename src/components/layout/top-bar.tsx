"use client";

import { BellIcon } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, type SessionUser } from "@/components/layout/user-menu";

/**
 * Barra superior fixa. No mobile mostra a marca (a navegação está embaixo);
 * a partir de md mostra apenas as ações à direita, já que a sidebar cobre a
 * identidade e a navegação.
 */
export function TopBar({ user, rootHref }: { user: SessionUser; rootHref: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
      <Brand href={rootHref} className="md:hidden" />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notificações"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <BellIcon />
          {/* Marcador de não lidas (visual - a lógica entra na fase de notificações) */}
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        <div className="md:hidden">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
