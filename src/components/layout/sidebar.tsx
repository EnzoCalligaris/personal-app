"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Brand } from "@/components/layout/brand";
import { isNavItemActive, navConfigs, type NavKey } from "@/components/layout/nav-config";
import { UserMenu, type SessionUser } from "@/components/layout/user-menu";

type SidebarProps = {
  navKey: NavKey;
  user: SessionUser;
};

/**
 * Navegação lateral. Em tablet (md) vira um rail só de ícones; a partir de lg
 * exibe os rótulos. No mobile ela não aparece (a navegação vai para a barra
 * inferior).
 */
export function Sidebar({ navKey, user }: SidebarProps) {
  const pathname = usePathname();
  const { items, rootHref } = navConfigs[navKey];

  return (
    <aside
      data-slot="sidebar"
      className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-sidebar-border bg-sidebar md:flex lg:w-[264px]"
    >
      <div className="flex h-16 items-center px-4 lg:px-5">
        <Brand href={rootHref} showWordmark={false} className="lg:hidden" />
        <Brand href={rootHref} className="hidden lg:flex" />
      </div>

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href, rootHref);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                "lg:justify-start",
                "justify-center lg:justify-start",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {/* Indicador de item ativo */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 h-6 w-1 rounded-r-full bg-primary transition-all duration-200",
                  active ? "opacity-100" : "scale-y-0 opacity-0"
                )}
              />
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu user={user} variant="sidebar" />
      </div>
    </aside>
  );
}
