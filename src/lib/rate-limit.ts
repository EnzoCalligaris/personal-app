import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Limite de tentativas nas rotas de autenticação.
 *
 * Sem isto, `/api/auth/login` aceita tentativas infinitas (força bruta),
 * `/api/auth/registro` aceita criação automatizada de contas e
 * `/api/auth/esqueci-senha` vira um disparador de e-mail contra qualquer
 * endereço.
 *
 * O contador vive no PostgreSQL, não na memória do processo: a imagem de
 * produção é `standalone` e pode subir em mais de uma instância, e um `Map`
 * local daria a cada réplica o seu próprio limite - ou seja, nenhum. É também
 * o único estado compartilhado que a aplicação já tem; nada de infraestrutura
 * nova só para contar tentativas.
 *
 * Cada chave é uma janela fixa: a primeira tentativa abre a janela, as
 * seguintes incrementam, e quando a janela vence tudo recomeça. O incremento é
 * um `INSERT ... ON CONFLICT DO UPDATE` só - atômico, sem transação e sem
 * corrida entre requisições simultâneas.
 */

export type Limite = {
  /** Quantas tentativas cabem na janela. */
  tentativas: number;
  /** Duração da janela, em segundos. */
  janelaSeg: number;
};

const MINUTO = 60;
const HORA = 60 * MINUTO;

/**
 * Os limites.
 *
 * No login só as **falhas** contam e o acerto zera o contador da conta: quem
 * sabe a senha nunca esbarra no limite, e quem está adivinhando esbarra rápido.
 * Por isso o teto por IP pode ser generoso sem afrouxar a proteção - ele existe
 * para o caso de alguém varrer muitas contas a partir do mesmo lugar, e é
 * folgado o bastante para não derrubar um escritório inteiro atrás de um NAT
 * por causa de um colega que errou a senha.
 *
 * No registro e na recuperação toda requisição conta, porque ali não existe
 * "tentativa certa" - o abuso é o próprio volume.
 */
export const LIMITES = {
  /** Falhas de login vindas do mesmo IP. */
  LOGIN_IP: { tentativas: 20, janelaSeg: 15 * MINUTO },
  /** Falhas de login contra a mesma conta, venham do IP que vierem. */
  LOGIN_CONTA: { tentativas: 5, janelaSeg: 15 * MINUTO },
  /** Cadastros a partir do mesmo IP. */
  REGISTRO_IP: { tentativas: 10, janelaSeg: 1 * HORA },
  /** Pedidos de recuperação a partir do mesmo IP. */
  RECUPERACAO_IP: { tentativas: 8, janelaSeg: 1 * HORA },
  /** Pedidos de recuperação para o mesmo endereço. */
  RECUPERACAO_CONTA: { tentativas: 3, janelaSeg: 1 * HORA },
} as const satisfies Record<string, Limite>;

/** Uma chave a verificar, com o limite que vale para ela. */
export type Alvo = { chave: string; limite: Limite };

export type Resultado =
  | { permitido: true }
  | { permitido: false; esperarSeg: number };

/* -------------------------------------------------------------------------
   Chaves
   ------------------------------------------------------------------------- */

/**
 * O e-mail entra hasheado.
 *
 * A tabela guarda tentativas de endereços que podem nem existir - na
 * recuperação de senha, qualquer um. Guardar o texto puro transformaria a
 * tabela numa lista de endereços sondados; o hash conta igual sem colecionar
 * nada legível.
 */
function digest(valor: string): string {
  return createHash("sha256").update(valor).digest("hex").slice(0, 32);
}

/** Normaliza o endereço para a mesma conta cair sempre na mesma chave. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function chaveDeIp(escopo: string, ip: string): string {
  return `${escopo}:ip:${digest(ip)}`;
}

export function chaveDeConta(escopo: string, email: string): string {
  return `${escopo}:conta:${digest(normalizarEmail(email))}`;
}

/* -------------------------------------------------------------------------
   IP do cliente
   ------------------------------------------------------------------------- */

/**
 * Onde cai quem não chegou por um proxy declarado.
 *
 * Um balde só, de propósito: sem proxy não existe endereço confiável, e fingir
 * que existe seria pior do que não separar.
 */
export const SEM_PROXY_CONFIAVEL = "sem-proxy-confiavel";

/**
 * Qual header carrega o endereço do cliente - se é que algum carrega.
 *
 * Não há como o servidor descobrir isso sozinho. O Next preenche
 * `x-forwarded-for` com o endereço do socket, mas **só quando o header não
 * veio na requisição** (`req.headers['x-forwarded-for'] ??= socket.remoteAddress`,
 * em next/dist/server/base-server.js). Se o cliente mandar o seu, é o dele que
 * fica, e no handler os dois casos são indistinguíveis: não sobra nada para
 * comparar. `NextRequest` também não expõe o endereço de origem nesta versão.
 *
 * Ou seja: o endereço só é confiável se algo na frente da aplicação
 * **sobrescrever** o header a cada requisição. Quem sabe se isso acontece é
 * quem faz o deploy, então é ele quem declara, nomeando o header em
 * `RATE_LIMIT_IP_HEADER` - `x-forwarded-for` atrás de nginx,
 * `cf-connecting-ip` atrás da Cloudflare.
 *
 * Sem essa declaração, em produção a aplicação para: um limite por IP que o
 * próprio cliente escolhe não protege ninguém, e passar batido seria pior do
 * que falhar alto. Em desenvolvimento e nos testes não há proxy nenhum, então
 * o pedido cai no balde único.
 */
function headerDeIpConfiavel(): string | null {
  const nome = process.env.RATE_LIMIT_IP_HEADER?.trim();
  if (nome) return nome.toLowerCase();

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RATE_LIMIT_IP_HEADER não definida. Informe o header que o proxy à frente" +
        " da aplicação sobrescreve com o endereço do cliente (x-forwarded-for" +
        " atrás de nginx, cf-connecting-ip atrás da Cloudflare). Sem proxy não" +
        " há endereço confiável e o limite por IP não protege. Veja .env.example."
    );
  }

  return null;
}

/**
 * De onde veio a requisição.
 *
 * Devolve o endereço só quando ele vem do header declarado pelo deploy; em
 * qualquer outro caso, o balde único. Note que isso inclui o pedido que chega
 * **sem** o header estando ele declarado: quem não passou pelo proxy não ganha
 * um balde próprio por isso.
 *
 * De um `x-forwarded-for` com vários endereços vale o mais à direita: quem
 * escreve à esquerda é o cliente, e o proxy da ponta acrescenta o endereço real
 * no fim.
 */
export function ipDaRequisicao(request: NextRequest): string {
  const header = headerDeIpConfiavel();
  if (!header) return SEM_PROXY_CONFIAVEL;

  const bruto = request.headers.get(header);
  if (!bruto) return SEM_PROXY_CONFIAVEL;

  const partes = bruto
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  return partes[partes.length - 1] ?? SEM_PROXY_CONFIAVEL;
}

/* -------------------------------------------------------------------------
   Contagem
   ------------------------------------------------------------------------- */

type Contagem = { tentativas: number; janelaFim: Date };

/** Incrementa a chave e devolve o estado da janela. Uma ida ao banco. */
async function incrementar(
  chave: string,
  limite: Limite,
  agora: Date
): Promise<Contagem> {
  const fim = new Date(agora.getTime() + limite.janelaSeg * 1000);

  const linhas = await prisma.$queryRaw<Contagem[]>`
    INSERT INTO "rate_limits" ("chave", "tentativas", "janelaFim")
    VALUES (${chave}, 1, ${fim})
    ON CONFLICT ("chave") DO UPDATE SET
      "tentativas" = CASE
        WHEN "rate_limits"."janelaFim" <= ${agora} THEN 1
        ELSE "rate_limits"."tentativas" + 1
      END,
      "janelaFim" = CASE
        WHEN "rate_limits"."janelaFim" <= ${agora} THEN ${fim}
        ELSE "rate_limits"."janelaFim"
      END
    RETURNING "tentativas", "janelaFim"`;

  return linhas[0];
}

/** Lê a chave sem consumir tentativa. */
async function ler(chave: string): Promise<Contagem | null> {
  const linhas = await prisma.$queryRaw<Contagem[]>`
    SELECT "tentativas", "janelaFim" FROM "rate_limits" WHERE "chave" = ${chave}`;
  return linhas[0] ?? null;
}

function segundosAte(fim: Date, agora: Date): number {
  return Math.max(1, Math.ceil((fim.getTime() - agora.getTime()) / 1000));
}

/**
 * Já estourou algum dos limites? Não consome tentativa.
 *
 * É o que roda **antes** de autenticar ou de mandar e-mail: se a resposta for
 * negativa, nada acontece depois.
 */
export async function verificar(alvos: Alvo[], agora: Date = new Date()): Promise<Resultado> {
  for (const { chave, limite } of alvos) {
    const atual = await ler(chave);
    if (!atual) continue;
    if (atual.janelaFim <= agora) continue;
    if (atual.tentativas >= limite.tentativas) {
      return { permitido: false, esperarSeg: segundosAte(atual.janelaFim, agora) };
    }
  }
  return { permitido: true };
}

/**
 * Consome uma tentativa em cada chave e diz se ainda cabia.
 *
 * Todas as chaves são incrementadas mesmo que uma já tenha estourado: a
 * tentativa aconteceu, e não contá-la nas outras deixaria uma brecha.
 */
export async function consumir(alvos: Alvo[], agora: Date = new Date()): Promise<Resultado> {
  let recusa: Resultado = { permitido: true };

  for (const { chave, limite } of alvos) {
    const atual = await incrementar(chave, limite, agora);
    if (atual.tentativas > limite.tentativas && recusa.permitido) {
      recusa = { permitido: false, esperarSeg: segundosAte(atual.janelaFim, agora) };
    }
  }

  return recusa;
}

/**
 * Devolve a tentativa que esta requisição consumiu.
 *
 * Serve para o caso em que só se sabe depois que a tentativa não devia ter
 * contado - no login, o acerto da senha. Diferente de `esquecer`, que zera a
 * chave inteira: aqui volta **uma** unidade, porque as outras tentativas
 * daquela chave podem ser de mais gente. Zerar o contador do IP porque alguém
 * acertou a própria senha apagaria as falhas de todo mundo que veio de lá.
 *
 * A linha some quando não sobra tentativa nenhuma: uma chave sem contagem não
 * precisa existir. O `DELETE` reconfere o valor, então uma tentativa que
 * chegue entre as duas instruções não é apagada por engano.
 */
export async function devolver(chaves: string[], agora: Date = new Date()): Promise<void> {
  if (chaves.length === 0) return;

  await prisma.rateLimit.updateMany({
    where: { chave: { in: chaves }, janelaFim: { gt: agora }, tentativas: { gt: 0 } },
    data: { tentativas: { decrement: 1 } },
  });

  await prisma.rateLimit.deleteMany({
    where: { chave: { in: chaves }, tentativas: { lte: 0 } },
  });
}

/** Esquece as tentativas de uma chave. Usado quando a senha finalmente confere. */
export async function esquecer(chaves: string[]): Promise<void> {
  if (chaves.length === 0) return;
  await prisma.rateLimit.deleteMany({ where: { chave: { in: chaves } } });
}

/**
 * Remove janelas já vencidas.
 *
 * Uma chave só é reaproveitada por quem volta a tentar; as demais ficam para
 * trás. Nada quebra por causa disso - a janela vencida é reiniciada no próximo
 * uso -, mas a tabela cresce com o tempo. Uma rotina periódica pode chamar
 * isto; não há nada que precise rodar dentro da requisição.
 */
export async function limparExpirados(antesDe: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { janelaFim: { lt: antesDe } },
  });
  return count;
}

/* -------------------------------------------------------------------------
   Resposta
   ------------------------------------------------------------------------- */

/**
 * A resposta de limite atingido.
 *
 * Sempre a mesma frase, venha de qual chave vier: dizer "esta conta está
 * bloqueada" contaria ao atacante que a conta existe. `Retry-After` é o que o
 * cliente precisa saber, e é tudo.
 */
export function respostaDeLimite(esperarSeg: number): NextResponse {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
    { status: 429, headers: { "Retry-After": String(esperarSeg) } }
  );
}
