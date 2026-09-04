import { Suspense } from "react";

import { AuthFooterLink, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre com sua conta de Personal Trainer ou de Aluno."
      footer={
        <>
          Não tem uma conta? <AuthFooterLink href="/registro">Criar conta</AuthFooterLink>
        </>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
