import { AuthFooterLink, AuthShell } from "@/components/auth/auth-shell";
import { EsqueciSenhaForm } from "@/components/auth/esqueci-senha-form";

export const metadata = { title: "Recuperar senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      description="Enviaremos um link de redefinição para o seu e-mail."
      footer={<AuthFooterLink href="/login">Voltar para o login</AuthFooterLink>}
    >
      <EsqueciSenhaForm />
    </AuthShell>
  );
}
