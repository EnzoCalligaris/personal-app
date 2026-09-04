import Link from "next/link";
import { RedefinirSenhaForm } from "@/components/auth/redefinir-senha-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth/session";

export default async function RedefinirSenhaPage() {
  const ctx = await getAuthContext();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {ctx ? (
            <RedefinirSenhaForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este link de redefinição é inválido ou expirou.{" "}
              <Link href="/esqueci-senha" className="font-medium text-foreground hover:underline">
                Solicitar um novo link
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
