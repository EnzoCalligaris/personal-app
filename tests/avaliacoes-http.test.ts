import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { Avaliacao, AvaliacaoListResponse } from "@/types/avaliacao";
import type { MinhaEvolucaoResponse } from "@/types/aluno-area";
import { resetDb } from "./db";
import { createAluno, createPersonal } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let bruno: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAna = "";

/** Primeira avaliação da Ana, usada nos testes de edição e exclusão. */
let primeira: Avaliacao;

function criar(cookie: string, corpo: unknown) {
  return fetch(
    `${BASE_URL}/api/personal/avaliacoes`,
    comCookie(cookie, { method: "POST", body: JSON.stringify(corpo) })
  );
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Personal" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });

  ana = await createAluno({ name: "Ana Aluna", personalId: personal.personalProfile.id });
  bruno = await createAluno({ name: "Bruno Aluno", personalId: personal.personalProfile.id });
  alunoDoOutro = await createAluno({
    name: "Aluno do Rival",
    personalId: outroPersonal.personalProfile.id,
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Avaliações - autorização", () => {
  it("exige autenticação e role PERSONAL", async () => {
    expect((await get("/api/personal/avaliacoes")).status).toBe(401);
    expect((await get("/api/personal/avaliacoes", cookieAna)).status).toBe(403);

    const comoAluno = await criar(cookieAna, { alunoId: ana.alunoProfile.id, peso: 60 });
    expect(comoAluno.status).toBe(403);
  });

  it("NÃO cria avaliação para aluno de outro Personal", async () => {
    const res = await criar(cookiePersonal, { alunoId: alunoDoOutro.alunoProfile.id, peso: 80 });
    expect(res.status).toBe(404);
  });
});

describe("Criar avaliação", () => {
  it("aceita só os campos que o equipamento mediu", async () => {
    const res = await criar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      data: "2026-06-10",
      peso: 66.8,
      percentualGordura: 28.4,
      massaMuscular: 24.1,
      // O resto da balança não mediu.
    });
    primeira = (await res.json()) as Avaliacao;

    expect(res.status).toBe(201);
    expect(primeira.aluno.nome).toBe("Ana Aluna");
    expect(primeira.data.slice(0, 10)).toBe("2026-06-10");
    expect(primeira.peso).toBe(66.8);
    expect(primeira.massaMuscular).toBe(24.1);
    // Campos não informados ficam nulos - nunca zero.
    expect(primeira.imc).toBeNull();
    expect(primeira.aguaPercentual).toBeNull();
    expect(primeira.metabolismoBasal).toBeNull();
    expect(primeira.medidas).toBeNull();
    // Sem avaliação anterior, não há variação.
    expect(primeira.variacao).toBeNull();
  });

  it("aceita uma avaliação completa, com medidas e observações", async () => {
    const res = await criar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      data: "2026-08-10",
      peso: 64.5,
      imc: 22.9,
      percentualGordura: 26.2,
      massaGorda: 16.9,
      massaMagra: 47.6,
      massaMuscular: 25.3,
      massaOssea: 2.6,
      aguaPercentual: 52.4,
      aguaLitros: 33.8,
      gorduraVisceral: 6,
      metabolismoBasal: 1420,
      idadeMetabolica: 27,
      observacoes: "Medição em jejum, balança da academia.",
      medidas: { cintura: 75, quadril: 96, braco: 29 },
    });
    const completa = (await res.json()) as Avaliacao;

    expect(res.status).toBe(201);
    expect(completa.metabolismoBasal).toBe(1420);
    expect(completa.gorduraVisceral).toBe(6);
    expect(completa.medidas).toEqual({ cintura: 75, quadril: 96, braco: 29 });
    expect(completa.observacoes).toBe("Medição em jejum, balança da academia.");

    // A variação compara com a avaliação anterior do mesmo aluno.
    expect(completa.variacao?.peso).toBe(-2.3);
    expect(completa.variacao?.percentualGordura).toBe(-2.2);
    expect(completa.variacao?.massaMuscular).toBe(1.2);
  });

  it("registra sem nenhuma medida (só a data)", async () => {
    const res = await criar(cookiePersonal, {
      alunoId: bruno.alunoProfile.id,
      data: "2026-08-01",
    });
    const vazia = (await res.json()) as Avaliacao;

    expect(res.status).toBe(201);
    expect(vazia.peso).toBeNull();
    expect(vazia.percentualGordura).toBeNull();
  });

  it("recusa valores fora do razoável", async () => {
    const res = await criar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      peso: 900,
      percentualGordura: 150,
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.peso).toBeTruthy();
    expect(body.issues.percentualGordura).toBeTruthy();
  });
});

describe("Listar e visualizar", () => {
  it("lista as avaliações do Personal, da mais recente para a mais antiga", async () => {
    const res = await get("/api/personal/avaliacoes", cookiePersonal);
    const data = (await res.json()) as AvaliacaoListResponse;

    expect(res.status).toBe(200);
    expect(data.total).toBe(3);
    expect(data.avaliacoes[0].data.slice(0, 10)).toBe("2026-08-10");
    expect(data.avaliacoes.at(-1)!.data.slice(0, 10)).toBe("2026-06-10");
    // O filtro por aluno vem pronto, com a contagem de cada um.
    expect(data.alunos.map((aluno) => aluno.nome)).toEqual(["Ana Aluna", "Bruno Aluno"]);
    expect(data.alunos[0].total).toBe(2);
  });

  it("filtra por aluno e busca por nome", async () => {
    const porAluno = (await (
      await get(`/api/personal/avaliacoes?alunoId=${bruno.alunoProfile.id}`, cookiePersonal)
    ).json()) as AvaliacaoListResponse;
    expect(porAluno.avaliacoes).toHaveLength(1);
    expect(porAluno.avaliacoes[0].aluno.nome).toBe("Bruno Aluno");

    const porNome = (await (
      await get("/api/personal/avaliacoes?q=ana", cookiePersonal)
    ).json()) as AvaliacaoListResponse;
    expect(porNome.avaliacoes).toHaveLength(2);
  });

  it("abre uma avaliação específica", async () => {
    const res = await get(`/api/personal/avaliacoes/${primeira.id}`, cookiePersonal);
    const avaliacao = (await res.json()) as Avaliacao;

    expect(res.status).toBe(200);
    expect(avaliacao.peso).toBe(66.8);
  });

  it("não mostra nem abre avaliação de outro Personal", async () => {
    const doOutro = (await (
      await get("/api/personal/avaliacoes", cookieOutroPersonal)
    ).json()) as AvaliacaoListResponse;
    expect(doOutro.avaliacoes).toHaveLength(0);

    const res = await get(`/api/personal/avaliacoes/${primeira.id}`, cookieOutroPersonal);
    expect(res.status).toBe(404);
  });
});

describe("Corrigir e excluir", () => {
  it("corrige medidas sem apagar o resto", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/avaliacoes/${primeira.id}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ peso: 67.2, imc: 23.8 }),
      })
    );
    const corrigida = (await res.json()) as Avaliacao;

    expect(res.status).toBe(200);
    expect(corrigida.peso).toBe(67.2);
    expect(corrigida.imc).toBe(23.8);
    // O que não foi enviado continua como estava.
    expect(corrigida.percentualGordura).toBe(28.4);
  });

  it("permite limpar um campo enviando null", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/avaliacoes/${primeira.id}`,
      comCookie(cookiePersonal, { method: "PATCH", body: JSON.stringify({ imc: null }) })
    );
    const corrigida = (await res.json()) as Avaliacao;

    expect(res.status).toBe(200);
    expect(corrigida.imc).toBeNull();
  });

  it("NÃO deixa outro Personal corrigir nem excluir", async () => {
    const patch = await fetch(
      `${BASE_URL}/api/personal/avaliacoes/${primeira.id}`,
      comCookie(cookieOutroPersonal, { method: "PATCH", body: JSON.stringify({ peso: 55 }) })
    );
    expect(patch.status).toBe(404);

    const del = await fetch(
      `${BASE_URL}/api/personal/avaliacoes/${primeira.id}`,
      comCookie(cookieOutroPersonal, { method: "DELETE" })
    );
    expect(del.status).toBe(404);

    const intacta = await prisma.avaliacao.findUniqueOrThrow({ where: { id: primeira.id } });
    expect(intacta.peso).toBe(67.2);
  });

  it("exclui a avaliação", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/avaliacoes/${primeira.id}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    expect(await prisma.avaliacao.findUnique({ where: { id: primeira.id } })).toBeNull();

    const lista = (await (
      await get("/api/personal/avaliacoes", cookiePersonal)
    ).json()) as AvaliacaoListResponse;
    expect(lista.total).toBe(2);
  });
});

describe("O que o aluno vê na evolução", () => {
  it("recebe as próprias avaliações, com massa muscular e água", async () => {
    const res = await get("/api/aluno/evolucao", cookieAna);
    const evolucao = (await res.json()) as MinhaEvolucaoResponse;

    expect(res.status).toBe(200);
    expect(evolucao.avaliacoes).toHaveLength(1);

    const avaliacao = evolucao.avaliacoes[0];
    expect(avaliacao.massaMuscular).toBe(25.3);
    expect(avaliacao.aguaPercentual).toBe(52.4);
    expect(avaliacao.metabolismoBasal).toBe(1420);
    expect(avaliacao.medidas).toEqual({ cintura: 75, quadril: 96, braco: 29 });

    // Com uma única avaliação, existe valor atual mas não há variação.
    expect(evolucao.massaMuscular?.atual).toBe(25.3);
    expect(evolucao.massaMuscular?.variacao).toBeNull();
  });

  it("calcula a variação quando há mais de uma avaliação", async () => {
    await criar(cookiePersonal, {
      alunoId: ana.alunoProfile.id,
      data: "2026-09-05",
      peso: 62.4,
      percentualGordura: 24.1,
      massaMuscular: 26.5,
    });

    const evolucao = (await (
      await get("/api/aluno/evolucao", cookieAna)
    ).json()) as MinhaEvolucaoResponse;

    expect(evolucao.avaliacoes).toHaveLength(2);
    expect(evolucao.massaMuscular?.atual).toBe(26.5);
    expect(evolucao.massaMuscular?.anterior).toBe(25.3);
    expect(evolucao.massaMuscular?.variacao).toBe(1.2);
    expect(evolucao.peso?.variacao).toBe(-2.1);
  });

  it("não vaza avaliação de outro aluno", async () => {
    const cookieBruno = (await login(bruno.user.email, SENHA)).cookie;
    const doBruno = (await (
      await get("/api/aluno/evolucao", cookieBruno)
    ).json()) as MinhaEvolucaoResponse;

    expect(doBruno.avaliacoes).toHaveLength(1);
    // A do Bruno é a que não tem nenhuma medida.
    expect(doBruno.avaliacoes[0].peso).toBeNull();
    expect(doBruno.peso).toBeNull();
  });
});
