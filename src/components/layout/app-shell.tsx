import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { navConfigs, type NavKey } from "@/components/layout/nav-config";
import type { SessionUser } from "@/components/layout/user-menu";

type AppShellProps = {
  /** Qual conjunto de navegação usar. Só a chave atravessa a fronteira
   * server -> client; os itens (com ícones) são importados no cliente. */
  navKey: NavKey;
  user: SessionUser;
  children: React.ReactNode;
};

/**
 * Casca da área autenticada:
 * - mobile: top bar + conteúdo + navegação inferior;
 * - tablet (md): rail lateral de ícones;
 * - desktop (lg): sidebar completa com rótulos.
 */
export function AppShell({ navKey, user, children }: AppShellProps) {
  const { rootHref } = navConfigs[navKey];

  return (
    <div className="flex min-h-dvh flex-col bg-background md:pl-[76px] lg:pl-[264px]">
      <Sidebar navKey={navKey} user={user} />
      <TopBar user={user} rootHref={rootHref} />

      <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <BottomNav navKey={navKey} />
    </div>
  );
}
