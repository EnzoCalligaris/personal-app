import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Área autenticada do Aluno. Sem treino/agenda ainda (próximas fases) - só
// confirma que a autenticação e o controle de acesso por role funcionam.
export default async function AlunoAreaPage() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "ALUNO" || !ctx.alunoProfileId) {
    redirect("/login");
  }

  const perfil = await prisma.alunoProfile.findUnique({
    where: { id: ctx.alunoProfileId },
    include: { personal: { include: { user: { select: { name: true, email: true } } } } },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {ctx.name}</h1>
          <p className="text-muted-foreground">Área do Aluno</p>
        </div>
        <LogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meu Personal Trainer</CardTitle>
          <CardDescription>Profissional responsável pelo seu acompanhamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {perfil?.personal ? (
            <p className="text-sm">
              <span className="font-medium">{perfil.personal.user.name}</span>{" "}
              <span className="text-muted-foreground">{perfil.personal.user.email}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você ainda não está vinculado a um Personal Trainer.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
