import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthContext } from "@/lib/auth/session";

export default async function AlunoLayout({ children }: LayoutProps<"/aluno">) {
  const ctx = await getAuthContext();

  if (!ctx || ctx.role !== "ALUNO" || !ctx.alunoProfileId) {
    redirect("/login");
  }

  return (
    <AppShell
      navKey="aluno"
      user={{
        name: ctx.name,
        email: ctx.email,
        role: ctx.role,
        profileHref: "/aluno/perfil",
      }}
    >
      {children}
    </AppShell>
  );
}
