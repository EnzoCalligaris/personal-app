import { afterAll, describe, expect, it } from "vitest";

import {
  dataDeCalendarioDe,
  FUSO_APP,
  hojeISO,
  instanteDeParede,
  limitesDoDia,
} from "@/lib/fuso";
import { dataDoInstante, diaSemanaDe, hojeUTC, paraISO } from "@/lib/date-utils";
import { instanteDoAtendimento, motivoParaNaoAgendar, podeDesmarcar } from "@/lib/agenda/regras";
import { REGRAS_PADRAO } from "@/lib/agenda/regras";
import { formatarDataCalendario, formatarDataRelativa, formatarDiaPorExtenso } from "@/lib/format";

/**
 * A aplicação atende no Brasil. O horário que o Personal escreve na agenda é
 * horário de São Paulo - e precisa continuar sendo, mesmo com o servidor
 * rodando em UTC, que é o padrão de qualquer contêiner.
 *
 * Este arquivo roda as mesmas contas com o fuso do processo trocado. Se
 * alguma delas voltar a depender do relógio do servidor, a comparação entre
 * os fusos falha aqui.
 *
 * O servidor usado pelos testes HTTP também sobe em UTC (ver
 * `tests/global-setup.ts`), então a suíte inteira cobre este risco.
 */

const TZ_ORIGINAL = process.env.TZ;

/** Roda `acao` com o fuso do processo trocado. */
function comFusoDoProcesso<T>(fuso: string, acao: () => T): T {
  process.env.TZ = fuso;
  try {
    return acao();
  } finally {
    process.env.TZ = TZ_ORIGINAL;
  }
}

const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Los_Angeles"];

afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

describe("O fuso do servidor não muda o resultado", () => {
  it("o instante de um atendimento é sempre o horário de São Paulo", () => {
    const casos: [string, string, string][] = [
      ["2026-09-08", "07:00", "2026-09-08T10:00:00.000Z"],
      ["2026-09-08", "00:00", "2026-09-08T03:00:00.000Z"],
      ["2026-09-08", "23:59", "2026-09-09T02:59:00.000Z"],
      ["2026-01-15", "18:30", "2026-01-15T21:30:00.000Z"],
      // Janeiro e junho: o Brasil não usa mais horário de verão, o
      // deslocamento é o mesmo o ano todo.
      ["2026-06-30", "12:00", "2026-06-30T15:00:00.000Z"],
    ];

    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        for (const [data, hora, esperado] of casos) {
          expect(instanteDeParede(data, hora).toISOString(), `${fuso}: ${data} ${hora}`).toBe(
            esperado
          );
          expect(instanteDoAtendimento(data, hora).toISOString()).toBe(esperado);
        }
      });
    }
  });

  it("o dia de um instante é lido no calendário brasileiro", () => {
    // 22:30 do dia 07 no Brasil: em UTC já é dia 08, mas o dia é 07.
    const noite = new Date("2026-09-07T22:30:00-03:00");
    // 21:00 do dia 07 no Brasil = meia-noite UTC do dia 08.
    const viradaUTC = new Date("2026-09-08T00:00:00Z");

    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        expect(dataDeCalendarioDe(noite), fuso).toBe("2026-09-07");
        expect(dataDeCalendarioDe(viradaUTC), fuso).toBe("2026-09-07");
        expect(paraISO(dataDoInstante(noite)), fuso).toBe("2026-09-07");
        expect(hojeISO(noite), fuso).toBe("2026-09-07");
        expect(paraISO(hojeUTC(noite)), fuso).toBe("2026-09-07");
      });
    }
  });

  it("o dia da semana de um instante segue o calendário brasileiro", () => {
    // Domingo, 22:30 no Brasil - em UTC já seria segunda.
    const domingoTarde = new Date("2026-09-06T22:30:00-03:00");

    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        expect(diaSemanaDe(domingoTarde), fuso).toBe("DOMINGO");
      });
    }
  });

  it("os limites do dia cobrem exatamente 24 horas brasileiras", () => {
    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        const { de, ate } = limitesDoDia("2026-09-08");

        expect(de.toISOString(), fuso).toBe("2026-09-08T03:00:00.000Z");
        expect(ate.toISOString(), fuso).toBe("2026-09-09T02:59:59.999Z");

        // Um treino às 22h do dia 08 (01h UTC do dia 09) pertence ao dia 08.
        const tarde = new Date("2026-09-08T22:00:00-03:00");
        expect(tarde >= de && tarde <= ate, fuso).toBe(true);

        // E a meia-noite do dia seguinte, não.
        expect(new Date("2026-09-09T00:00:00-03:00") > ate, fuso).toBe(true);
      });
    }
  });
});

describe("As regras da agenda não mudam com o fuso do servidor", () => {
  // 07/09 às 22:30 no Brasil. O atendimento é dia 08 às 07:00 - faltam 8h30.
  const agora = new Date("2026-09-07T22:30:00-03:00");
  const regras = { ...REGRAS_PADRAO, antecedenciaMinHoras: 12, cancelamentoMinHoras: 12 };

  it("a antecedência mínima é contada sobre o horário real", () => {
    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        const inicio = instanteDoAtendimento("2026-09-08", "07:00");
        // 8h30 de distância: abaixo das 12h exigidas, em qualquer fuso.
        expect(motivoParaNaoAgendar(inicio, regras, agora), fuso).toBe("ANTECEDENCIA");

        // O mesmo horário no dia seguinte passa: 32h30.
        const folgado = instanteDoAtendimento("2026-09-09", "07:00");
        expect(motivoParaNaoAgendar(folgado, regras, agora), fuso).toBeNull();
      });
    }
  });

  it("o prazo de cancelamento é contado sobre o horário real", () => {
    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        expect(podeDesmarcar(instanteDoAtendimento("2026-09-08", "07:00"), regras, agora), fuso)
          .toBe(false);
        expect(podeDesmarcar(instanteDoAtendimento("2026-09-09", "07:00"), regras, agora), fuso)
          .toBe(true);
      });
    }
  });

  it("um horário que já passou é recusado em qualquer fuso", () => {
    for (const fuso of FUSOS) {
      comFusoDoProcesso(fuso, () => {
        const ontem = instanteDoAtendimento("2026-09-06", "07:00");
        expect(motivoParaNaoAgendar(ontem, regras, agora), fuso).toBe("PASSADO");
      });
    }
  });
});

describe("O que a tela mostra", () => {
  it("uma data de calendário não escorrega de dia ao ser formatada", () => {
    // `new Date("2026-09-08")` seria meia-noite UTC: num fuso negativo, dia 07.
    for (const fuso of ["UTC", "America/Sao_Paulo", "America/Los_Angeles"]) {
      comFusoDoProcesso(fuso, () => {
        expect(formatarDataCalendario("2026-09-08"), fuso).toContain("08");
        expect(formatarDiaPorExtenso("2026-09-08"), fuso).toContain("8 de setembro");
      });
    }
  });

  it("'hoje' e 'ontem' contam dias do calendário, não intervalos de 24h", () => {
    const referencia = new Date("2026-09-08T08:00:00-03:00");

    expect(formatarDataRelativa("2026-09-08", referencia)).toBe("hoje");
    expect(formatarDataRelativa("2026-09-07", referencia)).toBe("ontem");
    expect(formatarDataRelativa("2026-09-09", referencia)).toBe("amanhã");

    // Um instante da noite anterior no Brasil (já dia seguinte em UTC).
    expect(formatarDataRelativa("2026-09-07T22:30:00-03:00", referencia)).toBe("ontem");
  });

  it("o fuso da aplicação é o do Brasil", () => {
    expect(FUSO_APP).toBe("America/Sao_Paulo");
  });
});
