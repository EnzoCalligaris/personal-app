import { AuthFooterLink, AuthShell } from "@/components/auth/auth-shell";
import { RegistroForm } from "@/components/auth/registro-form";

export const metadata = { title: "Criar conta" };

export default function RegistroPage() {
  return (
    <AuthShell
      title="Crie sua conta"
      description="Escolha o tipo de conta e comece em menos de um minuto."
      footer={
        <>
          Já tem uma conta? <AuthFooterLink href="/login">Entrar</AuthFooterLink>
        </>
      }
    >
      <RegistroForm />
    </AuthShell>
  );
}
