import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Fora do matcher, além dos estáticos: `/api/**`.
     *
     * O proxy só redireciona páginas - manda quem não tem sessão para /login e
     * quem tem a role errada de volta para a própria área. Numa rota de API ele
     * não decide nada: quem decide é a guarda dentro do handler
     * (`requireAuth`/`requirePersonal`/`requireAluno`), que lê a role do banco.
     *
     * Deixá-lo rodar aí custava uma validação de token inteira, com ida de rede
     * ao servidor de Auth, repetida logo depois pela guarda - metade do tempo
     * de cada chamada. A proteção é a mesma, endpoint por endpoint, e é isso
     * que `tests/seguranca-http.test.ts` verifica.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
