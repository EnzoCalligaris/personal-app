"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  bottomNavItems,
  isNavItemActive,
  navConfigs,
  type NavKey,
} from "@/components/layout/nav-config";

/**
 * Navegação inferior do mobile: alvos de toque grandes, rótulo curto e
 * indicador animado do item ativo. Some a partir de md (vira sidebar/rail).
 */
export function BottomNav({ navKey }: { navKey: NavKey }) {
  const pathname = usePathname();
  const { items, rootHref } = navConfigs[navKey];
  const visible = bottomNavItems(items);

  // Durante o treino a tela é um fluxo fechado, com saída própria (o × no
  // topo): a barra roubaria altura e convidaria ao toque errado no meio de
  // uma série. O botão da sessão assume o rodapé.
  if (pathname.endsWith("/sessao")) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-0.5">
        {visible.map((item) => {
          const active = isNavItemActive(pathname, item.href, rootHref);
          const Icon = item.icon;

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                {/* Traço do item ativo, ancorado no topo da barra */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 h-0.5 rounded-full bg-primary transition-all duration-300",
                    active ? "w-8 opacity-100" : "w-0 opacity-0"
                  )}
                />
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-all duration-200",
                    active ? "bg-primary/12 dark:bg-primary/18" : "group-active:scale-90"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate text-[0.65rem] leading-none font-medium">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
