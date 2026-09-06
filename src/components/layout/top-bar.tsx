"use client";

import { Brand } from "@/components/layout/brand";
import { Notificacoes } from "@/components/layout/notificacoes";
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

        <Notificacoes />

        <div className="md:hidden">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
