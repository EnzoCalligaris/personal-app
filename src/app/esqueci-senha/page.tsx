import Link from "next/link";
import { EsqueciSenhaForm } from "@/components/auth/esqueci-senha-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EsqueciSenhaPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Enviaremos um link de redefinição para o seu e-mail.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EsqueciSenhaForm />
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Voltar para o login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
