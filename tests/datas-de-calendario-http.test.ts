import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/date-utils";
import { formatarDataCalendario } from "@/lib/format";
import { resetDb } from "./db";
import {
  createAgendamento,
  createAluno,
  createAvaliacao,
  createFeedback,
  createPersonal,
} from "./factories";
import { get, login, SENHA } from "./http";

/**
 * O dia que a API devolve é o dia que ficou gravado.
 *
 * Uma coluna DATE guarda "04 de setembro", e nada sobre horas. Ao sair como
 * `2026-09-04T00:00:00.000Z`, a tela lê aquilo como um instante e o mostra no
 * fuso da aplicação - onde meia-noite em Londres são 21h do dia anterior aqui.
 * O resultado era a véspera: uma avaliação de 04/09 aparecia como 03/09.
 *
 * As datas abaixo são fixas e o formato é conferido inteiro. Comparar só os
 * dez primeiros caracteres passaria nos dois casos - foi exatamente assim que
 * o defeito sobreviveu à suíte por tanto tempo.
 */

/** Um dia de calendário é isto, e nada mais. */
const SO_A_DATA = /^\d{4}-\d{2}-\d{2}$/;

const AVALIACOES = ["2026-09-04", "2026-08-26", "2026-07-24"] as const;
const NASCIMENTO = "1995-03-17";
/** Bem à frente: o campo só considera atendimentos futuros. */
const PROXIMO_ATENDIMENTO = "2027-03-15";

let personal: Awaited<ReturnType<typeof createPersonal>>;
let ana: Awaited<ReturnType<typeof createAluno>>;
let cookiePersonal = "";
let cookieAna = "";

/**
 * Procura, em qualquer canto da resposta, uma data de calendário disfarçada de
 * instante. É a rede que pega o próximo lugar onde isso aparecer.
 */
function instantesDeMeiaNoite(valor: unknown, caminho = ""): string[] {
  if (typeof valor === "string") {
    return valor.endsWith("T00:00:00.000Z") ? [`${caminho} = ${valor}`] : [];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item, i) => instantesDeMeiaNoite(item, `${caminho}[${i}]`));
  }
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([chave, item]) =>
      instantesDeMeiaNoite(item, caminho ? `${caminho}.${chave}` : chave)
    );
  }
  return [];
}

beforeAll(async () => {
  await resetDb();

  personal = await createPersonal({ name: "Carlos Calendario" });
  ana = await createAluno({ name: "Ana Calendario", personalId: personal.personalProfile.id });

  await prisma.alunoProfile.update({
    where: { id: ana.alunoProfile.id },
    data: { dataNascimento: dataUTC(NASCIMENTO) },
  });

  const criadas = [];
  for (const iso of AVALIACOES) {
    criadas.push(
      await createAvaliacao(personal.personalProfile.id, ana.alunoProfile.id, {
        data: dataUTC(iso),
        peso: 62.4,
        percentualGordura: 24.1,
      })
    );
  }

  // Um comentário preso à avaliação mais antiga.
  await createFeedback(personal.personalProfile.id, ana.alunoProfile.id, {
    texto: "Sobre a avaliação de julho.",
    avaliacaoId: criadas[2].id,
  });

  await createAgendamento(personal.personalProfile.id, ana.alunoProfile.id, {
    data: dataUTC(PROXIMO_ATENDIMENTO),
    horaInicio: "07:00",
    horaFim: "08:00",
    status: "CONFIRMADO",
  });

  cookiePersonal = (await login(personal.user.email, SENHA)).cookie;
  cookieAna = (await login(ana.user.email, SENHA)).cookie;
}, 120000);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Avaliações", () => {
  it("cada data volta exatamente como foi gravada", async () => {
    const res = await get("/api/personal/avaliacoes", cookiePersonal);
    expect(res.status).toBe(200);

    const { avaliacoes } = (await res.json()) as { avaliacoes: { data: string }[] };
    const datas = avaliacoes.map((a) => a.data).sort().reverse();

    expect(datas).toEqual(["2026-09-04", "2026-08-26", "2026-07-24"]);

    for (const data of datas) {
      expect(data, `${data} deveria ser só a data`).toMatch(SO_A_DATA);
      expect(data).not.toContain("T");
    }
  }, 60000);

  it("a avaliação buscada por id também", async () => {
    const lista = (await (await get("/api/personal/avaliacoes", cookiePersonal)).json()) as {
      avaliacoes: { id: string; data: string }[];
    };
    const alvo = lista.avaliacoes.find((a) => a.data === "2026-09-04")!;

    const res = await get(`/api/personal/avaliacoes/${alvo.id}`, cookiePersonal);
    const detalhe = (await res.json()) as { data: string };

    expect(detalhe.data).toBe("2026-09-04");
    expect(detalhe.data).toMatch(SO_A_DATA);
  }, 60000);

  it("e a tela mostra o dia certo", () => {
    // O que o componente faz com o valor que a API devolve.
    expect(formatarDataCalendario("2026-09-04")).toContain("04");
    expect(formatarDataCalendario("2026-08-26")).toContain("26");
    expect(formatarDataCalendario("2026-07-24")).toContain("24");

    // E o formato antigo mostrava a véspera - é o defeito, guardado aqui para
    // não haver dúvida sobre o que mudou.
    expect(formatarDataCalendario("2026-09-04T00:00:00.000Z")).toContain("03");
  });
});

describe("Dashboard do Personal", () => {
  it("a avaliação recente e o atendimento saem como data", async () => {
    const res = await get("/api/personal/dashboard", cookiePersonal);
    const dados = (await res.json()) as {
      avaliacoesRecentes: { data: string }[];
      proximosAgendamentos: { data: string }[];
      hoje: { data: string };
    };

    expect(dados.avaliacoesRecentes[0].data).toBe("2026-09-04");
    expect(dados.avaliacoesRecentes[0].data).toMatch(SO_A_DATA);

    expect(dados.proximosAgendamentos[0].data).toBe(PROXIMO_ATENDIMENTO);
    expect(dados.proximosAgendamentos[0].data).toMatch(SO_A_DATA);

    // Sem regressão do lado dos instantes: "agora" continua sendo um instante.
    expect(dados.hoje.data).toContain("T");
    expect(dados.hoje.data).toMatch(/Z$/);
  }, 60000);
});

describe("Alunos", () => {
  it("a última avaliação na listagem sai como data", async () => {
    const res = await get("/api/personal/alunos", cookiePersonal);
    const { alunos } = (await res.json()) as {
      alunos: { ultimaAvaliacao: { data: string } | null; criadoEm: string }[];
    };

    expect(alunos[0].ultimaAvaliacao?.data).toBe("2026-09-04");
    expect(alunos[0].ultimaAvaliacao?.data).toMatch(SO_A_DATA);

    // `criadoEm` é instante e continua sendo.
    expect(alunos[0].criadoEm).toContain("T");
  }, 60000);

  it("nascimento e próximo atendimento saem como data", async () => {
    const res = await get(`/api/personal/alunos/${ana.alunoProfile.id}`, cookiePersonal);
    const detalhe = (await res.json()) as {
      dataNascimento: string | null;
      metricas: { proximoAgendamento: string | null; ultimaExecucao: string | null };
    };

    expect(detalhe.dataNascimento).toBe(NASCIMENTO);
    expect(detalhe.dataNascimento).toMatch(SO_A_DATA);

    expect(detalhe.metricas.proximoAgendamento).toBe(PROXIMO_ATENDIMENTO);
    expect(detalhe.metricas.proximoAgendamento).toMatch(SO_A_DATA);
  }, 60000);
});

describe("Feedbacks", () => {
  it("a avaliação citada sai como data, dos dois lados", async () => {
    const doPersonal = (await (await get("/api/personal/feedbacks", cookiePersonal)).json()) as {
      feedbacks: { avaliacao: { data: string } | null; criadoEm: string }[];
    };
    expect(doPersonal.feedbacks[0].avaliacao?.data).toBe("2026-07-24");
    expect(doPersonal.feedbacks[0].avaliacao?.data).toMatch(SO_A_DATA);
    expect(doPersonal.feedbacks[0].criadoEm).toContain("T");

    const doAluno = (await (await get("/api/aluno/feedbacks", cookieAna)).json()) as {
      feedbacks: { avaliacao: { data: string } | null }[];
    };
    expect(doAluno.feedbacks[0].avaliacao?.data).toBe("2026-07-24");
    expect(doAluno.feedbacks[0].avaliacao?.data).toMatch(SO_A_DATA);
  }, 60000);
});

describe("Nenhuma data de calendário disfarçada de instante", () => {
  /**
   * Varre a resposta inteira atrás de `T00:00:00.000Z`. Um instante de verdade
   * praticamente nunca cai na meia-noite exata em Londres; uma data de
   * calendário serializada errada cai sempre.
   */
  const rotas: [string, () => string][] = [
    ["/api/personal/avaliacoes", () => cookiePersonal],
    ["/api/personal/dashboard", () => cookiePersonal],
    ["/api/personal/alunos", () => cookiePersonal],
    ["/api/personal/feedbacks", () => cookiePersonal],
    ["/api/personal/agenda", () => cookiePersonal],
    ["/api/aluno/dashboard", () => cookieAna],
    ["/api/aluno/agenda", () => cookieAna],
    ["/api/aluno/feedbacks", () => cookieAna],
    ["/api/aluno/evolucao", () => cookieAna],
  ];

  it("em nenhuma das rotas que devolvem datas", async () => {
    for (const [rota, cookie] of rotas) {
      const res = await get(rota, cookie());
      expect(res.status, rota).toBe(200);

      const achados = instantesDeMeiaNoite(await res.json());
      expect(achados, `${rota} devolveu data de calendário como instante`).toEqual([]);
    }
  }, 120000);

  it("o detalhe do aluno também", async () => {
    const res = await get(`/api/personal/alunos/${ana.alunoProfile.id}`, cookiePersonal);
    expect(instantesDeMeiaNoite(await res.json())).toEqual([]);
  }, 60000);
});
