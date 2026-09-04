import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Área autenticada do Personal. Sem dashboard/estatísticas ainda (Fase 3+) -
// só confirma que a autenticação e o controle de acesso por role funcionam.
export default async function PersonalAreaPage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "PERSONAL" || !ctx.personalProfileId) {
    redirect("/login");
  }

  const alunos = await prisma.alunoProfile.findMany({
    where: { personalId: ctx.personalProfileId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {ctx.name}</h1>
          <p className="text-muted-foreground">Área do Personal Trainer</p>
        </div>
        <LogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus alunos ({alunos.length})</CardTitle>
          <CardDescription>Alunos vinculados à sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {alunos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno vinculado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {alunos.map((aluno) => (
                <li key={aluno.id} className="rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{aluno.user.name}</span>{" "}
                  <span className="text-muted-foreground">{aluno.user.email}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
