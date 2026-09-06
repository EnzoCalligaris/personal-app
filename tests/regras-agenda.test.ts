import { describe, expect, it } from "vitest";

import {
  dataDoInstante,
  dataUTC,
  diaSemanaDeDataUTC,
  intervaloDeDatas,
  limitesDoDiaLocal,
  paraISO,
  somarDiasUTC,
} from "@/lib/date-utils";
import { deMinutos, gerarSlots, paraMinutos, removerOcupados, sobrepoe } from "@/lib/agenda/horarios";
import {
  instanteDoAtendimento,
  motivoParaNaoAgendar,
  podeDesmarcar,
  REGRAS_PADRAO,
} from "@/lib/agenda/regras";
import type { RegrasAgendamento } from "@/types/agenda";

/**
 * As regras que decidem se um horário existe, se ele conflita e se o aluno
 * pode mexer nele. Os testes HTTP já cobrem o caminho feliz de cada uma; aqui
 * o alvo são as bordas - encostar sem sobrepor, a sobra da faixa, o minuto
 * exato do prazo, a virada de mês - que são caras de montar por HTTP.
 */

describe("Aritmética de horários", () => {
  it("converte HH:MM para minutos e de volta", () => {
    expect(paraMinutos("00:00")).toBe(0);
    expect(paraMinutos("06:30")).toBe(390);
    expect(paraMinutos("23:59")).toBe(1439);

    for (const hora of ["00:00", "07:05", "12:00", "18:45", "23:59"]) {
      expect(deMinutos(paraMinutos(hora))).toBe(hora);
    }
  });

  it("preenche com zero à esquerda", () => {
    expect(deMinutos(0)).toBe("00:00");
    expect(deMinutos(65)).toBe("01:05");
  });
});

describe("Sobreposição de intervalos", () => {
  it("dois atendimentos encostados NÃO se sobrepõem", () => {
    // 08:00-09:00 e 09:00-10:00 podem coexistir: o fim é aberto.
    expect(sobrepoe("08:00", "09:00", "09:00", "10:00")).toBe(false);
    expect(sobrepoe("09:00", "10:00", "08:00", "09:00")).toBe(false);
  });

  it("detecta cruzamento parcial nos dois sentidos", () => {
    expect(sobrepoe("08:00", "09:00", "08:30", "09:30")).toBe(true);
    expect(sobrepoe("08:30", "09:30", "08:00", "09:00")).toBe(true);
  });

  it("detecta intervalo contido e intervalos idênticos", () => {
    expect(sobrepoe("08:00", "12:00", "09:00", "10:00")).toBe(true);
    expect(sobrepoe("09:00", "10:00", "08:00", "12:00")).toBe(true);
    expect(sobrepoe("08:00", "09:00", "08:00", "09:00")).toBe(true);
  });

  it("intervalos distantes não se sobrepõem", () => {
    expect(sobrepoe("06:00", "07:00", "14:00", "15:00")).toBe(false);
  });

  it("um minuto de encontro já é conflito", () => {
    expect(sobrepoe("08:00", "09:00", "08:59", "09:59")).toBe(true);
  });
});

describe("Geração de atendimentos a partir da faixa", () => {
  it("divide a faixa em blocos da duração pedida", () => {
    expect(gerarSlots("08:00", "11:00", 60)).toEqual([
      { horaInicio: "08:00", horaFim: "09:00" },
      { horaInicio: "09:00", horaFim: "10:00" },
      { horaInicio: "10:00", horaFim: "11:00" },
    ]);
  });

  it("descarta a sobra: não existe atendimento pela metade", () => {
    // 08:00-09:30 com 60min cabe um atendimento; os 30min finais somem.
    expect(gerarSlots("08:00", "09:30", 60)).toEqual([
      { horaInicio: "08:00", horaFim: "09:00" },
    ]);
  });

  it("faixa menor que a duração não gera nada", () => {
    expect(gerarSlots("08:00", "08:45", 60)).toEqual([]);
  });

  it("faixa invertida ou vazia não gera nada", () => {
    expect(gerarSlots("12:00", "08:00", 60)).toEqual([]);
    expect(gerarSlots("08:00", "08:00", 60)).toEqual([]);
  });

  it("duração inválida não trava em laço infinito", () => {
    expect(gerarSlots("08:00", "12:00", 0)).toEqual([]);
    expect(gerarSlots("08:00", "12:00", -30)).toEqual([]);
  });

  it("respeita durações que não são de uma hora", () => {
    expect(gerarSlots("06:00", "07:30", 45)).toEqual([
      { horaInicio: "06:00", horaFim: "06:45" },
      { horaInicio: "06:45", horaFim: "07:30" },
    ]);
  });
});

describe("Remoção dos horários ocupados", () => {
  const slots = gerarSlots("08:00", "12:00", 60);

  it("tira apenas os que cruzam um agendamento", () => {
    const livres = removerOcupados(slots, [{ horaInicio: "09:00", horaFim: "10:00" }]);
    expect(livres.map((slot) => slot.horaInicio)).toEqual(["08:00", "10:00", "11:00"]);
  });

  it("um bloqueio longo derruba todos os blocos que ele cobre", () => {
    const livres = removerOcupados(slots, [{ horaInicio: "08:30", horaFim: "11:30" }]);
    expect(livres).toEqual([]);
  });

  it("ocupação encostada não derruba o bloco vizinho", () => {
    const livres = removerOcupados(slots, [{ horaInicio: "07:00", horaFim: "08:00" }]);
    expect(livres.map((slot) => slot.horaInicio)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("sem ocupação, devolve tudo", () => {
    expect(removerOcupados(slots, [])).toHaveLength(4);
  });
});

describe("Regras do aluno para marcar", () => {
  const agora = new Date(2026, 8, 6, 10, 0, 0); // 06/09/2026, 10:00 local
  const regras: RegrasAgendamento = { ...REGRAS_PADRAO, antecedenciaMinHoras: 12, janelaDias: 30 };

  function daquiA(horas: number) {
    return new Date(agora.getTime() + horas * 60 * 60 * 1000);
  }

  it("libera um horário dentro de todas as regras", () => {
    expect(motivoParaNaoAgendar(daquiA(24), regras, agora)).toBeNull();
  });

  it("recusa horário no passado", () => {
    expect(motivoParaNaoAgendar(daquiA(-1), regras, agora)).toBe("PASSADO");
    // O instante exato de agora também já passou.
    expect(motivoParaNaoAgendar(agora, regras, agora)).toBe("PASSADO");
  });

  it("recusa dentro da antecedência mínima e aceita no limite exato", () => {
    expect(motivoParaNaoAgendar(daquiA(11.9), regras, agora)).toBe("ANTECEDENCIA");
    expect(motivoParaNaoAgendar(daquiA(12), regras, agora)).toBeNull();
  });

  it("recusa além da janela liberada", () => {
    expect(motivoParaNaoAgendar(daquiA(24 * 31), regras, agora)).toBe("FORA_DA_JANELA");
    expect(motivoParaNaoAgendar(daquiA(24 * 29), regras, agora)).toBeNull();
  });

  it("o Personal desligar o agendamento tem precedência sobre o resto", () => {
    const desligado = { ...regras, permiteAgendamento: false };
    expect(motivoParaNaoAgendar(daquiA(24), desligado, agora)).toBe("AGENDAMENTO_DESATIVADO");
    // Mesmo para um horário que já seria recusado por outro motivo.
    expect(motivoParaNaoAgendar(daquiA(-1), desligado, agora)).toBe("AGENDAMENTO_DESATIVADO");
  });

  it("antecedência zero deixa marcar para daqui a pouco", () => {
    const semAntecedencia = { ...regras, antecedenciaMinHoras: 0 };
    expect(motivoParaNaoAgendar(daquiA(0.5), semAntecedencia, agora)).toBeNull();
  });
});

describe("Regras do aluno para desmarcar", () => {
  const agora = new Date(2026, 8, 6, 10, 0, 0);
  const regras: RegrasAgendamento = { ...REGRAS_PADRAO, cancelamentoMinHoras: 12 };

  function daquiA(horas: number) {
    return new Date(agora.getTime() + horas * 60 * 60 * 1000);
  }

  it("permite fora do prazo mínimo e recusa dentro dele", () => {
    expect(podeDesmarcar(daquiA(13), regras, agora)).toBe(true);
    expect(podeDesmarcar(daquiA(11), regras, agora)).toBe(false);
  });

  it("o limite exato ainda permite", () => {
    expect(podeDesmarcar(daquiA(12), regras, agora)).toBe(true);
  });

  it("atendimento que já passou não é mais desmarcável", () => {
    expect(podeDesmarcar(daquiA(-1), regras, agora)).toBe(false);
  });

  it("prazo zero permite cancelar até a hora de começar", () => {
    const semPrazo = { ...regras, cancelamentoMinHoras: 0 };
    expect(podeDesmarcar(daquiA(0.1), semPrazo, agora)).toBe(true);
    expect(podeDesmarcar(daquiA(-0.1), semPrazo, agora)).toBe(false);
  });
});

describe("Instante do atendimento", () => {
  it("junta data de calendário e hora no fuso local", () => {
    const inicio = instanteDoAtendimento("2026-09-07", "06:30");

    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(8); // setembro
    expect(inicio.getDate()).toBe(7);
    expect(inicio.getHours()).toBe(6);
    expect(inicio.getMinutes()).toBe(30);
  });

  it("mantém a ordem cronológica entre horários do mesmo dia", () => {
    const cedo = instanteDoAtendimento("2026-09-07", "06:00");
    const tarde = instanteDoAtendimento("2026-09-07", "18:00");
    expect(cedo.getTime()).toBeLessThan(tarde.getTime());
  });
});

/**
 * As datas do calendário são o ponto onde a aplicação já errou: um treino
 * indo parar no dia anterior por causa do fuso do servidor.
 */
describe("Datas de calendário em UTC", () => {
  it("converte ISO para data e de volta sem escorregar de dia", () => {
    for (const iso of ["2026-01-01", "2026-09-07", "2026-12-31"]) {
      expect(paraISO(dataUTC(iso))).toBe(iso);
    }
  });

  it("guarda a data na meia-noite UTC", () => {
    const data = dataUTC("2026-09-07");
    expect(data.toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(paraISO(somarDiasUTC(dataUTC("2026-09-30"), 1))).toBe("2026-10-01");
    expect(paraISO(somarDiasUTC(dataUTC("2026-12-31"), 1))).toBe("2027-01-01");
    expect(paraISO(somarDiasUTC(dataUTC("2026-03-01"), -1))).toBe("2026-02-28");
  });

  it("acerta o ano bissexto", () => {
    expect(paraISO(somarDiasUTC(dataUTC("2028-02-28"), 1))).toBe("2028-02-29");
    expect(paraISO(somarDiasUTC(dataUTC("2028-02-29"), 1))).toBe("2028-03-01");
  });

  it("resolve o dia da semana pela leitura UTC", () => {
    expect(diaSemanaDeDataUTC(dataUTC("2026-09-06"))).toBe("DOMINGO");
    expect(diaSemanaDeDataUTC(dataUTC("2026-09-07"))).toBe("SEGUNDA");
    expect(diaSemanaDeDataUTC(dataUTC("2026-09-12"))).toBe("SABADO");
  });

  it("o intervalo inclui as duas pontas", () => {
    const datas = intervaloDeDatas(dataUTC("2026-09-07"), dataUTC("2026-09-09"));
    expect(datas.map(paraISO)).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  it("intervalo de um dia só devolve esse dia", () => {
    const datas = intervaloDeDatas(dataUTC("2026-09-07"), dataUTC("2026-09-07"));
    expect(datas.map(paraISO)).toEqual(["2026-09-07"]);
  });

  it("intervalo invertido é vazio", () => {
    expect(intervaloDeDatas(dataUTC("2026-09-09"), dataUTC("2026-09-07"))).toEqual([]);
  });

  it("a semana de uma vista tem sete dias", () => {
    const datas = intervaloDeDatas(dataUTC("2026-09-06"), dataUTC("2026-09-12"));
    expect(datas).toHaveLength(7);
  });
});

/**
 * O par que liga os dois mundos: agendamento guarda instante local, a
 * programação raciocina em data de calendário.
 */
describe("Instante local x data de calendário", () => {
  it("um instante do fim do dia continua no mesmo dia do calendário", () => {
    const tarde = new Date(2026, 8, 7, 23, 30, 0);
    expect(paraISO(dataDoInstante(tarde))).toBe("2026-09-07");
  });

  it("um instante do começo do dia também", () => {
    const cedo = new Date(2026, 8, 7, 0, 15, 0);
    expect(paraISO(dataDoInstante(cedo))).toBe("2026-09-07");
  });

  it("os limites locais de uma data cobrem o dia inteiro e nada além", () => {
    const { de, ate } = limitesDoDiaLocal(dataUTC("2026-09-07"));

    expect(de.getDate()).toBe(7);
    expect(de.getHours()).toBe(0);
    expect(ate.getDate()).toBe(7);
    expect(ate.getHours()).toBe(23);
    expect(ate.getMinutes()).toBe(59);

    // Um atendimento em qualquer hora do dia cai dentro da janela.
    for (const hora of [0, 6, 12, 23]) {
      const instante = new Date(2026, 8, 7, hora, 0, 0);
      expect(instante >= de && instante <= ate).toBe(true);
    }

    // E o dia seguinte fica de fora.
    expect(new Date(2026, 8, 8, 0, 0, 0) > ate).toBe(true);
  });

  it("a ida e volta entre instante e data é estável", () => {
    const instante = new Date(2026, 8, 7, 18, 45, 0);
    const { de } = limitesDoDiaLocal(dataDoInstante(instante));
    expect(de.getFullYear()).toBe(instante.getFullYear());
    expect(de.getMonth()).toBe(instante.getMonth());
    expect(de.getDate()).toBe(instante.getDate());
  });
});
