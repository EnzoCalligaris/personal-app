import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthContext } from "@/lib/auth/session";

export default async function PersonalLayout({ children }: LayoutProps<"/personal">) {
  const ctx = await getAuthContext();

  if (!ctx || ctx.role !== "PERSONAL" || !ctx.personalProfileId) {
    redirect("/login");
  }

  return (
    <AppShell
      navKey="personal"
      user={{
        name: ctx.name,
        email: ctx.email,
        role: ctx.role,
        profileHref: "/personal/perfil",
      }}
    >
      {children}
    </AppShell>
  );
}
