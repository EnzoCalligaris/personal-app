import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { PersonalDashboard } from "@/components/personal/dashboard";

export const metadata = { title: "Visão geral" };

export default async function PersonalOverviewPage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "PERSONAL" || !ctx.personalProfileId) {
    redirect("/login");
  }

  // Os dados vêm de /api/personal/dashboard (client), para que os estados de
  // carregamento, vazio e erro sejam reais e o usuário possa tentar de novo.
  return <PersonalDashboard primeiroNome={ctx.name.split(" ")[0]} />;
}
