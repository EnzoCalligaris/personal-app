import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { CalendarioResponse, DiaPrevisto, Programacao, ProgramacaoListResponse } from "@/types/programacao";
import { resetDb } from "./db";
import { createAluno, createHistorico, createPersonal, createTreino } from "./factories";
import { BASE_URL, get, login, SENHA } from "./http";

function comCookie(cookie: string, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers ?? {}) },
  };
}

/** Datas fixas para os testes não dependerem do dia em que a suíte roda. */
const SEGUNDA = "2026-03-02";
const TERCA = "2026-03-03";
const QUARTA = "2026-03-04";
const QUINTA = "2026-03-05";
const SEXTA = "2026-03-06";
const SABADO = "2026-03-07";
const DOMINGO = "2026-03-08";
const SEGUNDA_SEGUINTE = "2026-03-09";

let personal: Awaited<ReturnType<typeof createPersonal>>;
let outroPersonal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let alunoDoOutro: Awaited<ReturnType<typeof createAluno>>;

let treinoA = { id: "" };
let treinoB = { id: "" };
let treinoC = { id: "" };
let treinoDoOutroAluno = { id: "" };

let cookiePersonal = "";
let cookieOutroPersonal = "";
let cookieAluno = "";

let programacaoId = "";

async function treinoDoDia(alunoId: string, data: string, cookie = cookiePersonal) {
  const res = await get(`/api/personal/alunos/${alunoId}/treino-do-dia?data=${data}`, cookie);
  return { status: res.status, body: (await res.json()) as DiaPrevisto };
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Personal Programação" });
  outroPersonal = await createPersonal({ name: "Personal Rival" });

  ana = await createAluno({ name: "Ana Programação", personalId: personal.personalProfile.id });
  alunoDoOutro = await createAluno({
    name: "Aluno do Rival",
    personalId: outroPersonal.personalProfile.id,
  });

  treinoA = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino A",
  });
  treinoB = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino B",
  });
  treinoC = await createTreino(personal.personalProfile.id, ana.alunoProfile.id, {
    nome: "Treino C",
  });
  treinoDoOutroAluno = await createTreino(
    outroPersonal.personalProfile.id,
    alunoDoOutro.alunoProfile.id,
    { nome: "Treino do rival" }
  );

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieOutroPersonal = (await login(outroPersonal.user.email, SENHA)).cookie;
  cookieAluno = (await login(ana.user.email, SENHA)).cookie;
}, 60000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Programação - autorização", () => {
  it("exige autenticação", async () => {
    expect((await get(`/api/personal/programacoes?alunoId=${ana.alunoProfile.id}`)).status).toBe(401);
  });

  it("nega acesso a um Aluno (endpoint administrativo)", async () => {
    const res = await get(`/api/personal/programacoes?alunoId=${ana.alunoProfile.id}`, cookieAluno);
    expect(res.status).toBe(403);
  });

  it("NÃO deixa criar programação para aluno de outro Personal", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({ alunoId: alunoDoOutro.alunoProfile.id, dataInicio: SEGUNDA }),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("Programação - montar a semana", () => {
  it("cria a programação com o período e os dias iniciais", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          nome: "Bloco 1",
          dataInicio: SEGUNDA,
          dias: [
            { diaSemana: "SEGUNDA", treinoId: treinoA.id },
            { diaSemana: "TERCA", treinoId: treinoB.id },
          ],
        }),
      })
    );
    const programacao = (await res.json()) as Programacao;

    expect(res.status).toBe(201);
    expect(programacao.dataInicio).toBe(SEGUNDA);
    expect(programacao.dataFim).toBeNull();
    // Sempre devolve os 7 dias; os sem treino são descanso.
    expect(programacao.dias).toHaveLength(7);
    expect(programacao.dias.find((dia) => dia.diaSemana === "SEGUNDA")?.treino?.nome).toBe("Treino A");
    expect(programacao.dias.find((dia) => dia.diaSemana === "QUARTA")?.treino).toBeNull();

    programacaoId = programacao.id;
  });

  it("associa treino a um dia e permite o mesmo treino em dias diferentes", async () => {
    const quinta = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/QUINTA`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoA.id }) })
    );
    expect(quinta.status).toBe(200);

    const sexta = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/SEXTA`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoC.id }) })
    );
    const programacao = (await sexta.json()) as Programacao;

    expect(sexta.status).toBe(200);
    // Segunda → A, Terça → B, Quarta → descanso, Quinta → A, Sexta → C
    const porDia = Object.fromEntries(
      programacao.dias.map((dia) => [dia.diaSemana, dia.treino?.nome ?? "DESCANSO"])
    );
    expect(porDia).toMatchObject({
      SEGUNDA: "Treino A",
      TERCA: "Treino B",
      QUARTA: "DESCANSO",
      QUINTA: "Treino A",
      SEXTA: "Treino C",
      SABADO: "DESCANSO",
      DOMINGO: "DESCANSO",
    });
  });

  it("altera o treino de um dia", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/TERCA`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoC.id }) })
    );
    const programacao = (await res.json()) as Programacao;

    expect(res.status).toBe(200);
    expect(programacao.dias.find((dia) => dia.diaSemana === "TERCA")?.treino?.nome).toBe("Treino C");

    // Volta para o Treino B, que é o cenário usado nos testes seguintes.
    await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/TERCA`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoB.id }) })
    );
  });

  it("remove o treino de um dia (vira descanso)", async () => {
    await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/SABADO`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoC.id }) })
    );

    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/SABADO`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    const programacao = (await res.json()) as Programacao;

    expect(res.status).toBe(200);
    expect(programacao.dias.find((dia) => dia.diaSemana === "SABADO")?.treino).toBeNull();
  });

  it("recusa dia da semana inválido", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/FERIADO`,
      comCookie(cookiePersonal, { method: "PUT", body: JSON.stringify({ treinoId: treinoA.id }) })
    );
    expect(res.status).toBe(400);
  });

  it("NÃO deixa programar treino de outro aluno", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/DOMINGO`,
      comCookie(cookiePersonal, {
        method: "PUT",
        body: JSON.stringify({ treinoId: treinoDoOutroAluno.id }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("NÃO deixa outro Personal mexer na programação", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}/dias/DOMINGO`,
      comCookie(cookieOutroPersonal, {
        method: "PUT",
        body: JSON.stringify({ treinoId: treinoA.id }),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("Treino previsto para uma data", () => {
  it("resolve cada dia da semana conforme a programação", async () => {
    const segunda = await treinoDoDia(ana.alunoProfile.id, SEGUNDA);
    expect(segunda.status).toBe(200);
    expect(segunda.body.tipo).toBe("TREINO");
    expect(segunda.body.treino?.nome).toBe("Treino A");
    expect(segunda.body.diaSemana).toBe("SEGUNDA");

    expect((await treinoDoDia(ana.alunoProfile.id, TERCA)).body.treino?.nome).toBe("Treino B");

    const quarta = await treinoDoDia(ana.alunoProfile.id, QUARTA);
    expect(quarta.body.tipo).toBe("DESCANSO");
    expect(quarta.body.treino).toBeNull();

    expect((await treinoDoDia(ana.alunoProfile.id, QUINTA)).body.treino?.nome).toBe("Treino A");
    expect((await treinoDoDia(ana.alunoProfile.id, SEXTA)).body.treino?.nome).toBe("Treino C");
    expect((await treinoDoDia(ana.alunoProfile.id, SABADO)).body.tipo).toBe("DESCANSO");
  });

  it("repete a rotina na semana seguinte", async () => {
    const proximaSegunda = await treinoDoDia(ana.alunoProfile.id, SEGUNDA_SEGUINTE);
    expect(proximaSegunda.body.tipo).toBe("TREINO");
    expect(proximaSegunda.body.treino?.nome).toBe("Treino A");
  });

  it("responde SEM_PROGRAMACAO para datas antes do início", async () => {
    const antes = await treinoDoDia(ana.alunoProfile.id, "2026-02-23");
    expect(antes.body.tipo).toBe("SEM_PROGRAMACAO");
    expect(antes.body.programacao).toBeNull();
  });

  it("marca o dia como executado quando há histórico registrado", async () => {
    await createHistorico(treinoA.id, ana.alunoProfile.id, {
      dataExecucao: new Date(`${SEGUNDA}T10:00:00.000Z`),
    });

    const segunda = await treinoDoDia(ana.alunoProfile.id, SEGUNDA);
    expect(segunda.body.executado).toBe(true);
    expect((await treinoDoDia(ana.alunoProfile.id, TERCA)).body.executado).toBe(false);
  });

  it("recusa data em formato inválido", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/treino-do-dia?data=02-03-2026`,
      cookiePersonal
    );
    expect(res.status).toBe(400);
  });

  it("não deixa outro Personal consultar o treino do dia do aluno", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/treino-do-dia?data=${SEGUNDA}`,
      cookieOutroPersonal
    );
    expect(res.status).toBe(404);
  });
});

describe("Calendário", () => {
  it("devolve uma linha por data do período", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/calendario?de=${SEGUNDA}&ate=${DOMINGO}`,
      cookiePersonal
    );
    const calendario = (await res.json()) as CalendarioResponse;

    expect(res.status).toBe(200);
    expect(calendario.dias).toHaveLength(7);
    expect(calendario.dias.map((dia) => dia.data)).toEqual([
      SEGUNDA,
      TERCA,
      QUARTA,
      QUINTA,
      SEXTA,
      SABADO,
      DOMINGO,
    ]);
    expect(calendario.dias.map((dia) => dia.tipo)).toEqual([
      "TREINO",
      "TREINO",
      "DESCANSO",
      "TREINO",
      "TREINO",
      "DESCANSO",
      "DESCANSO",
    ]);
  });

  it("atravessa a virada de mês sem perder dias", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/calendario?de=2026-03-30&ate=2026-04-02`,
      cookiePersonal
    );
    const calendario = (await res.json()) as CalendarioResponse;

    expect(calendario.dias.map((dia) => dia.data)).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
    ]);
    // 30/03 é segunda -> Treino A; 01/04 é quarta -> descanso.
    expect(calendario.dias[0].treino?.nome).toBe("Treino A");
    expect(calendario.dias[2].tipo).toBe("DESCANSO");
  });

  it("recusa período invertido", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/calendario?de=${SEXTA}&ate=${SEGUNDA}`,
      cookiePersonal
    );
    expect(res.status).toBe(400);
  });
});

describe("Mudança de programação", () => {
  it("encerra a programação anterior ao criar uma nova", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes`,
      comCookie(cookiePersonal, {
        method: "POST",
        body: JSON.stringify({
          alunoId: ana.alunoProfile.id,
          nome: "Bloco 2",
          // Começa na segunda seguinte.
          dataInicio: SEGUNDA_SEGUINTE,
          dias: [{ diaSemana: "SEGUNDA", treinoId: treinoC.id }],
        }),
      })
    );
    expect(res.status).toBe(201);

    const anterior = await prisma.programacao.findUniqueOrThrow({ where: { id: programacaoId } });
    // Encerrada na véspera do início da nova (domingo 08/03).
    expect(anterior.dataFim?.toISOString().slice(0, 10)).toBe(DOMINGO);
  });

  it("cada data passa a responder pela programação vigente naquele dia", async () => {
    // Ainda no Bloco 1.
    expect((await treinoDoDia(ana.alunoProfile.id, SEGUNDA)).body.treino?.nome).toBe("Treino A");
    expect((await treinoDoDia(ana.alunoProfile.id, SEXTA)).body.treino?.nome).toBe("Treino C");

    // Já no Bloco 2: segunda vira Treino C e os outros dias viram descanso.
    const novaSegunda = await treinoDoDia(ana.alunoProfile.id, SEGUNDA_SEGUINTE);
    expect(novaSegunda.body.treino?.nome).toBe("Treino C");
    expect(novaSegunda.body.programacao?.nome).toBe("Bloco 2");

    const novaTerca = await treinoDoDia(ana.alunoProfile.id, "2026-03-10");
    expect(novaTerca.body.tipo).toBe("DESCANSO");
    expect(novaTerca.body.programacao?.nome).toBe("Bloco 2");
  });

  it("o calendário mostra a virada entre as duas programações", async () => {
    const res = await get(
      `/api/personal/alunos/${ana.alunoProfile.id}/calendario?de=${SABADO}&ate=2026-03-10`,
      cookiePersonal
    );
    const calendario = (await res.json()) as CalendarioResponse;

    // 07/03 sáb (Bloco 1, descanso), 08/03 dom (Bloco 1, descanso),
    // 09/03 seg (Bloco 2, Treino C), 10/03 ter (Bloco 2, descanso)
    expect(calendario.dias.map((dia) => dia.programacao?.nome)).toEqual([
      "Bloco 1",
      "Bloco 1",
      "Bloco 2",
      "Bloco 2",
    ]);
    expect(calendario.dias[2].treino?.nome).toBe("Treino C");
  });

  it("lista o histórico e identifica a vigente", async () => {
    const res = await get(
      `/api/personal/programacoes?alunoId=${ana.alunoProfile.id}`,
      cookiePersonal
    );
    const data = (await res.json()) as ProgramacaoListResponse;

    expect(res.status).toBe(200);
    expect(data.programacoes.map((programacao) => programacao.nome)).toEqual(["Bloco 2", "Bloco 1"]);
    // Como as datas do cenário são de março/2026, nenhuma está vigente hoje.
    expect(data.programacoes.every((programacao) => typeof programacao.vigente === "boolean")).toBe(
      true
    );
  });

  it("edita o período e valida datas invertidas", async () => {
    const invalida = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ dataInicio: SEXTA, dataFim: SEGUNDA }),
      })
    );
    expect(invalida.status).toBe(400);

    const valida = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}`,
      comCookie(cookiePersonal, {
        method: "PATCH",
        body: JSON.stringify({ nome: "Bloco 1 (revisado)", dataFim: SABADO }),
      })
    );
    const programacao = (await valida.json()) as Programacao;

    expect(valida.status).toBe(200);
    expect(programacao.nome).toBe("Bloco 1 (revisado)");
    expect(programacao.dataFim).toBe(SABADO);

    // Com o Bloco 1 terminando no sábado, o domingo fica sem programação.
    const domingo = await treinoDoDia(ana.alunoProfile.id, DOMINGO);
    expect(domingo.body.tipo).toBe("SEM_PROGRAMACAO");
  });

  it("exclui uma programação sem afetar os treinos", async () => {
    const res = await fetch(
      `${BASE_URL}/api/personal/programacoes/${programacaoId}`,
      comCookie(cookiePersonal, { method: "DELETE" })
    );
    expect(res.status).toBe(200);

    expect(await prisma.programacao.findUnique({ where: { id: programacaoId } })).toBeNull();
    // As fichas continuam lá.
    expect(await prisma.treino.count({ where: { alunoId: ana.alunoProfile.id } })).toBe(3);

    // E as datas do Bloco 1 voltam a não ter programação.
    expect((await treinoDoDia(ana.alunoProfile.id, SEGUNDA)).body.tipo).toBe("SEM_PROGRAMACAO");
  });
});
