import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { AlunoDashboard } from "@/components/aluno/dashboard";

export const metadata = { title: "Início" };

export default async function AlunoHomePage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "ALUNO" || !ctx.alunoProfileId) {
    redirect("/login");
  }

  // Os dados vêm de /api/aluno/dashboard (client), para os estados de
  // carregamento, vazio e erro serem reais - e o id do aluno sair da sessão,
  // nunca da URL.
  return <AlunoDashboard primeiroNome={ctx.name.split(" ")[0]} />;
}
