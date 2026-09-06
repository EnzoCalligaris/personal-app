/**
 * Trava de segurança: estes seeds criam contas com senha conhecida. Rodar
 * isso contra um banco de produção seria abrir a aplicação para qualquer um.
 * Só passa em banco local; para um banco remoto de propósito (um ambiente de
 * homologação, por exemplo), exporte PERMITIR_SEED_REMOTO=1.
 */
export function garantirBancoLocal() {
  if (process.env.PERMITIR_SEED_REMOTO === "1") return;

  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal|db)[:/]/.test(url);

  if (process.env.NODE_ENV === "production" || !local) {
    throw new Error(
      "Seed bloqueado: DATABASE_URL não aponta para um banco local.\n" +
        "Estes dados são de teste, com senha pública - nunca devem ir para produção.\n" +
        "Se a intenção é mesmo popular um banco remoto, rode com PERMITIR_SEED_REMOTO=1."
    );
  }
}
