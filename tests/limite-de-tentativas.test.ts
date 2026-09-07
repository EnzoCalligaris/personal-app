import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  chaveDeConta,
  chaveDeIp,
  consumir,
  esquecer,
  limparExpirados,
  LIMITES,
  normalizarEmail,
  verificar,
} from "@/lib/rate-limit";
import { resetDb } from "./db";
import { createPersonal } from "./factories";
import { BASE_URL, login, SENHA } from "./http";

/**
 * O limite de tentativas das rotas de autenticação.
 *
 * A contagem por janela é testada com um relógio explícito: cada caso diz que
 * horas são, então "a janela venceu" não depende de esperar de verdade nem da
 * hora em que a suíte roda.
 *
 * As rotas HTTP são exercitadas por repetição - ali o relógio é o do servidor,
 * e o que se verifica é o comportamento observável: 429, `Retry-After`, e que
 * a operação protegida não acontece depois do limite.
 */

const AGORA = new Date("2026-09-16T12:00:00Z");
const emDepois = (segundos: number) => new Date(AGORA.getTime() + segundos * 1000);

/** Um limite pequeno, para os casos de janela ficarem legíveis. */
const TRES_POR_MINUTO = { tentativas: 3, janelaSeg: 60 };

let personal: Awaited<ReturnType<typeof createPersonal>>;

async function limparContadores() {
  await prisma.$executeRawUnsafe(`DELETE FROM "rate_limits";`);
}

beforeAll(async () => {
  await resetDb();
  personal = await createPersonal({ name: "Carlos Limite" });
}, 60000);

beforeEach(limparContadores);

afterAll(async () => {
  await limparContadores();
  await resetDb();
  await prisma.$disconnect();
});

describe("Contagem por janela", () => {
  const alvo = (chave: string) => [{ chave, limite: TRES_POR_MINUTO }];

  it("deixa passar até o limite e barra a partir dali", async () => {
    const chave = chaveDeIp("teste", "10.0.0.1");

    for (let i = 1; i <= 3; i++) {
      const r = await consumir(alvo(chave), AGORA);
      expect(r.permitido, `tentativa ${i}`).toBe(true);
    }

    const quarta = await consumir(alvo(chave), AGORA);
    expect(quarta.permitido).toBe(false);
    if (!quarta.permitido) expect(quarta.esperarSeg).toBe(60);
  });

  it("a espera devolvida encolhe conforme a janela corre", async () => {
    const chave = chaveDeIp("teste", "10.0.0.2");
    for (let i = 0; i < 4; i++) await consumir(alvo(chave), AGORA);

    const meio = await verificar(alvo(chave), emDepois(45));
    expect(meio.permitido).toBe(false);
    if (!meio.permitido) expect(meio.esperarSeg).toBe(15);
  });

  it("passada a janela, tudo recomeça", async () => {
    const chave = chaveDeIp("teste", "10.0.0.3");
    for (let i = 0; i < 4; i++) await consumir(alvo(chave), AGORA);

    expect((await verificar(alvo(chave), emDepois(59))).permitido).toBe(false);
    expect((await verificar(alvo(chave), emDepois(61))).permitido).toBe(true);

    // E a janela nova conta do zero.
    const depois = emDepois(61);
    for (let i = 1; i <= 3; i++) {
      expect((await consumir(alvo(chave), depois)).permitido, `tentativa ${i}`).toBe(true);
    }
    expect((await consumir(alvo(chave), depois)).permitido).toBe(false);
  });

  it("verificar não gasta tentativa", async () => {
    const chave = chaveDeIp("teste", "10.0.0.4");

    for (let i = 0; i < 10; i++) {
      expect((await verificar(alvo(chave), AGORA)).permitido).toBe(true);
    }
    expect((await consumir(alvo(chave), AGORA)).permitido).toBe(true);
  });

  it("esquecer zera a chave", async () => {
    const chave = chaveDeIp("teste", "10.0.0.5");
    for (let i = 0; i < 4; i++) await consumir(alvo(chave), AGORA);
    expect((await verificar(alvo(chave), AGORA)).permitido).toBe(false);

    await esquecer([chave]);
    expect((await verificar(alvo(chave), AGORA)).permitido).toBe(true);
  });

  it("chaves diferentes não se atrapalham", async () => {
    const meu = chaveDeIp("teste", "10.0.0.6");
    const outro = chaveDeIp("teste", "10.0.0.7");

    for (let i = 0; i < 4; i++) await consumir(alvo(meu), AGORA);

    expect((await verificar(alvo(meu), AGORA)).permitido).toBe(false);
    expect((await verificar(alvo(outro), AGORA)).permitido).toBe(true);
  });

  it("o mesmo e-mail cai na mesma chave, escrito como for", async () => {
    const variantes = ["Pessoa@Exemplo.com", "  pessoa@exemplo.com  ", "PESSOA@EXEMPLO.COM"];
    const chaves = new Set(variantes.map((e) => chaveDeConta("login", e)));

    expect(chaves.size, "todas deveriam gerar uma chave só").toBe(1);
    expect(normalizarEmail("  Pessoa@Exemplo.com ")).toBe("pessoa@exemplo.com");
  });

  it("a chave não guarda o e-mail nem o IP em texto", async () => {
    const chave = chaveDeConta("login", "alguem@exemplo.com");
    expect(chave).not.toContain("alguem");
    expect(chave).not.toContain("exemplo.com");
    expect(chaveDeIp("login", "203.0.113.7")).not.toContain("203.0.113.7");
  });

  it("a limpeza remove só as janelas vencidas", async () => {
    await consumir([{ chave: chaveDeIp("teste", "10.0.0.8"), limite: TRES_POR_MINUTO }], AGORA);
    await consumir(
      [{ chave: chaveDeIp("teste", "10.0.0.9"), limite: { tentativas: 3, janelaSeg: 3600 } }],
      AGORA
    );

    const removidas = await limparExpirados(emDepois(120));
    expect(removidas).toBe(1);
    expect(await prisma.rateLimit.count()).toBe(1);
  });
});

describe("Login", () => {
  /** O acerto zera a conta, então o teto por conta é o que estoura primeiro. */
  it("o acerto de senha não gasta tentativa", async () => {
    for (let i = 0; i < LIMITES.LOGIN_CONTA.tentativas + 2; i++) {
      const res = await login(personal.user.email, SENHA);
      expect(res.status, `login ${i + 1}`).toBe(200);
    }
    expect(await prisma.rateLimit.count()).toBe(0);
  }, 60000);

  it("errar a senha o suficiente devolve 429 com Retry-After", async () => {
    const email = personal.user.email;

    // Até o limite, a resposta é a de credencial inválida.
    for (let i = 0; i < LIMITES.LOGIN_CONTA.tentativas; i++) {
      const res = await login(email, "SenhaErrada@123");
      expect(res.status, `falha ${i + 1}`).toBe(401);
    }

    const barrado = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "SenhaErrada@123" }),
    });

    expect(barrado.status).toBe(429);

    const espera = Number(barrado.headers.get("retry-after"));
    expect(Number.isFinite(espera)).toBe(true);
    expect(espera).toBeGreaterThan(0);
    expect(espera).toBeLessThanOrEqual(LIMITES.LOGIN_CONTA.janelaSeg);

    // Nada de detalhe interno na resposta.
    const corpo = await barrado.text();
    expect(corpo).not.toMatch(/rate_limit|prisma|postgres|sql|conta:|ip:/i);

    // E a senha certa também é barrada: o limite vale antes de autenticar.
    expect((await login(email, SENHA)).status).toBe(429);
  }, 60000);

  it("o limite de uma conta não derruba as outras do mesmo IP", async () => {
    const vitima = await createPersonal({ name: "Alvo do Ataque" });

    for (let i = 0; i < LIMITES.LOGIN_CONTA.tentativas; i++) {
      await login(vitima.user.email, "SenhaErrada@123");
    }
    expect((await login(vitima.user.email, SENHA)).status).toBe(429);

    // Outra pessoa, mesmo IP: segue entrando.
    expect((await login(personal.user.email, SENHA)).status).toBe(200);
  }, 60000);

  it("acertar a senha limpa o histórico de falhas da conta", async () => {
    const email = personal.user.email;

    for (let i = 0; i < LIMITES.LOGIN_CONTA.tentativas - 1; i++) {
      expect((await login(email, "SenhaErrada@123")).status).toBe(401);
    }

    expect((await login(email, SENHA)).status).toBe(200);

    // O contador voltou ao zero: dá para errar tudo de novo sem ser barrado.
    for (let i = 0; i < LIMITES.LOGIN_CONTA.tentativas - 1; i++) {
      expect((await login(email, "SenhaErrada@123")).status, `falha ${i + 1}`).toBe(401);
    }
  }, 60000);
});

describe("Recuperação de senha", () => {
  const pedir = (email: string) =>
    fetch(`${BASE_URL}/api/auth/esqueci-senha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

  it("passa a recusar depois do limite por endereço, com Retry-After", async () => {
    const email = "alvo-do-spam@example.com";

    for (let i = 0; i < LIMITES.RECUPERACAO_CONTA.tentativas; i++) {
      expect((await pedir(email)).status, `pedido ${i + 1}`).toBe(200);
    }

    const barrado = await pedir(email);
    expect(barrado.status).toBe(429);
    expect(Number(barrado.headers.get("retry-after"))).toBeGreaterThan(0);
  }, 60000);

  it("o limite não conta se o endereço existe ou não", async () => {
    const existente = personal.user.email;
    const inexistente = "nao-existe-mesmo@example.com";

    // Os dois esgotam o limite com o mesmo número de pedidos e a mesma
    // resposta - se o endereço inexistente fosse barrado antes (ou depois),
    // isso já contaria que a conta existe.
    for (const email of [existente, inexistente]) {
      const respostas: number[] = [];
      for (let i = 0; i < LIMITES.RECUPERACAO_CONTA.tentativas + 1; i++) {
        respostas.push((await pedir(email)).status);
      }
      expect(respostas, email).toEqual([200, 200, 200, 429]);
    }
  }, 60000);
});

describe("Cadastro", () => {
  it("recusa a partir do limite por IP, sem criar a conta", async () => {
    const criar = (n: number) =>
      fetch(`${BASE_URL}/api/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Cadastro em Massa ${n}`,
          email: `massa-${n}-${Date.now()}@example.com`,
          password: "SenhaBoa@123",
          role: "ALUNO",
        }),
      });

    for (let i = 0; i < LIMITES.REGISTRO_IP.tentativas; i++) {
      expect((await criar(i)).status, `cadastro ${i + 1}`).toBe(201);
    }

    const barrado = await criar(99);
    expect(barrado.status).toBe(429);
    expect(Number(barrado.headers.get("retry-after"))).toBeGreaterThan(0);

    // A conta recusada não existe em lugar nenhum.
    const criados = await prisma.user.count({ where: { email: { startsWith: "massa-99-" } } });
    expect(criados).toBe(0);
  }, 120000);

  it("corpo inválido não gasta tentativa", async () => {
    const invalido = () =>
      fetch(`${BASE_URL}/api/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "A", email: "sem-arroba", password: "x" }),
      });

    for (let i = 0; i < LIMITES.REGISTRO_IP.tentativas + 3; i++) {
      expect((await invalido()).status, `inválido ${i + 1}`).toBe(400);
    }

    expect(await prisma.rateLimit.count()).toBe(0);
  }, 60000);
});

/**
 * A corrida que o passo anterior deixou em aberto.
 *
 * O login perguntava se ainda cabia, autenticava, e só então contava a falha.
 * Entre a pergunta e a resposta cabia outra requisição inteira - dez
 * simultâneas perguntavam antes de qualquer uma contar, e as dez passavam. Um
 * atacante com concorrência N tentava N senhas por janela em vez de cinco.
 *
 * Cada caso usa um IP próprio, para o teto por conta e o teto por IP não se
 * misturarem. As rajadas são disparadas juntas e resolvidas com
 * `Promise.all`: são requisições concorrentes de verdade contra o mesmo
 * contador, não chamadas em sequência.
 */
describe("Login sob concorrência", () => {
  const tentar = (email: string, senha: string, ip: string) =>
    fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ email, password: senha }),
    }).then((r) => r.status);

  /** Quantas tentativas a chave registrou. */
  async function contador(chave: string): Promise<number> {
    const linha = await prisma.rateLimit.findUnique({ where: { chave } });
    return linha?.tentativas ?? 0;
  }

  const LIMITE = LIMITES.LOGIN_CONTA.tentativas;

  it("A) dez falhas em sequência: cinco chegam ao Auth, o resto é barrado", async () => {
    const email = personal.user.email;
    const respostas: number[] = [];

    for (let i = 0; i < 10; i++) respostas.push(await tentar(email, "SenhaErrada@1", "198.18.0.1"));

    expect(respostas.filter((s) => s === 401)).toHaveLength(LIMITE);
    expect(respostas.filter((s) => s === 429)).toHaveLength(10 - LIMITE);
    // E os cinco primeiros são os que passaram.
    expect(respostas.slice(0, LIMITE).every((s) => s === 401)).toBe(true);
  }, 60000);

  it("B) dez falhas simultâneas: no máximo cinco chegam ao Auth", async () => {
    const email = personal.user.email;

    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => tentar(email, "SenhaErrada@1", "198.18.0.2"))
    );

    const chegaram = respostas.filter((s) => s === 401).length;
    expect(chegaram).toBeLessThanOrEqual(LIMITE);
    expect(respostas.filter((s) => s === 429).length).toBe(10 - chegaram);
    // Nenhuma outra forma de resposta - nada de 500 sob concorrência.
    expect(respostas.every((s) => s === 401 || s === 429)).toBe(true);
  }, 60000);

  it("C) o contador registra a rajada inteira e não libera mais nada", async () => {
    const email = personal.user.email;
    const chave = chaveDeConta("login", email);

    await Promise.all(
      Array.from({ length: 10 }, () => tentar(email, "SenhaErrada@1", "198.18.0.3"))
    );

    // Toda tentativa foi contada, inclusive as barradas: quem insiste não
    // encurta a espera.
    expect(await contador(chave)).toBe(10);

    // E a conta segue bloqueada, inclusive para a senha certa.
    expect(await tentar(email, SENHA, "198.18.0.3")).toBe(429);
  }, 60000);

  it("D) o acerto devolve a tentativa que consumiu, inclusive na do IP", async () => {
    const email = personal.user.email;
    const ip = "198.18.0.4";

    expect(await tentar(email, SENHA, ip)).toBe(200);

    // Nem a conta nem o IP ficam com tentativa pendurada.
    expect(await contador(chaveDeConta("login", email))).toBe(0);
    expect(await contador(chaveDeIp("login", ip))).toBe(0);
  }, 60000);

  it("E) falha, falha, acerto, falha: o acerto zera o histórico da conta", async () => {
    const email = personal.user.email;
    const ip = "198.18.0.5";
    const chave = chaveDeConta("login", email);

    expect(await tentar(email, "SenhaErrada@1", ip)).toBe(401);
    expect(await tentar(email, "SenhaErrada@1", ip)).toBe(401);
    expect(await contador(chave)).toBe(2);

    expect(await tentar(email, SENHA, ip)).toBe(200);
    expect(await contador(chave)).toBe(0);

    expect(await tentar(email, "SenhaErrada@1", ip)).toBe(401);
    expect(await contador(chave)).toBe(1);
  }, 60000);

  it("F/I) o teto por IP também segura sob concorrência", async () => {
    const ip = "198.18.0.6";
    const teto = LIMITES.LOGIN_IP.tentativas;
    const rajada = teto + 8;

    // Contas distintas: cada uma tem contador próprio em 1, então quem decide
    // é o teto do IP. Endereços inexistentes falham igual e contam igual.
    const respostas = await Promise.all(
      Array.from({ length: rajada }, (_, i) => tentar(`corrida-${i}@example.com`, "SenhaX@123", ip))
    );

    const chegaram = respostas.filter((s) => s === 401).length;
    expect(chegaram).toBeLessThanOrEqual(teto);
    expect(respostas.filter((s) => s === 429).length).toBe(rajada - chegaram);
    expect(respostas.every((s) => s === 401 || s === 429)).toBe(true);

    // Simultâneo não rende mais tentativas que sequencial: o IP está fechado.
    expect(await tentar("mais-um@example.com", "SenhaX@123", ip)).toBe(429);
  }, 120000);

  it("G) contas diferentes têm limites independentes", async () => {
    const outra = await createPersonal({ name: "Outra Conta Limite" });
    const ip = "198.18.0.7";

    for (let i = 0; i < LIMITE; i++) {
      expect(await tentar(personal.user.email, "SenhaErrada@1", ip)).toBe(401);
    }
    expect(await tentar(personal.user.email, "SenhaErrada@1", ip)).toBe(429);

    // A outra conta começa do zero, e ainda cabe no teto do IP (20).
    expect(await tentar(outra.user.email, "SenhaErrada@1", ip)).toBe(401);
    expect(await contador(chaveDeConta("login", outra.user.email))).toBe(1);
  }, 60000);

  it("H) uma conta no limite não impede outra de entrar do mesmo IP", async () => {
    const outra = await createPersonal({ name: "Vizinha de IP" });
    const ip = "198.18.0.8";

    for (let i = 0; i < LIMITE + 1; i++) {
      await tentar(personal.user.email, "SenhaErrada@1", ip);
    }
    expect(await tentar(personal.user.email, SENHA, ip)).toBe(429);

    // Quem sabe a própria senha entra normalmente.
    expect(await tentar(outra.user.email, SENHA, ip)).toBe(200);
  }, 60000);
});
