import { AuthFooterLink, AuthShell } from "@/components/auth/auth-shell";
import { RedefinirSenhaForm } from "@/components/auth/redefinir-senha-form";
import { ErrorState } from "@/components/ui/error-state";
import { getAuthContext } from "@/lib/auth/session";

export const metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage() {
  const ctx = await getAuthContext();

  return (
    <AuthShell
      title="Redefinir senha"
      description="Escolha uma nova senha para sua conta."
      footer={<AuthFooterLink href="/login">Voltar para o login</AuthFooterLink>}
    >
      {ctx ? (
        <RedefinirSenhaForm />
      ) : (
        <ErrorState
          size="sm"
          title="Link inválido ou expirado"
          description="Solicite um novo link de redefinição para continuar."
          action={<AuthFooterLink href="/esqueci-senha">Solicitar novo link</AuthFooterLink>}
        />
      )}
    </AuthShell>
  );
}
