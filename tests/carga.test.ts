import { describe, expect, it } from "vitest";

import { cargaParaCampoNumerico, exibirCarga, formatarCarga } from "@/lib/treinos/carga";

/**
 * Campo "Carga" do exercício no treino: o Personal digita só o número e a
 * ficha mostra "<número> kg". Registros antigos, salvos em formatos livres
 * ("40kg", "40 kg", "peso corporal"), continuam existindo como estão até
 * serem editados - nada aqui reescreve o banco.
 */
describe("exibirCarga", () => {
  it("acrescenta o sufixo kg a um número inteiro puro", () => {
    expect(exibirCarga("40")).toBe("40 kg");
  });

  it("acrescenta o sufixo kg a um número decimal, com vírgula pt-BR", () => {
    expect(exibirCarga("22.5")).toBe("22,5 kg");
    expect(exibirCarga("22,5")).toBe("22,5 kg");
  });

  it("mantém como está uma carga legada que já tem a unidade colada", () => {
    expect(exibirCarga("40kg")).toBe("40kg");
  });

  it("mantém como está uma carga legada com espaço antes da unidade", () => {
    expect(exibirCarga("40 kg")).toBe("40 kg");
  });

  it("mantém texto livre sem número reconhecível", () => {
    expect(exibirCarga("peso corporal")).toBe("peso corporal");
    expect(exibirCarga("20kg cada")).toBe("20kg cada");
  });

  it("nunca duplica a unidade (sem 40kgkg)", () => {
    for (const valor of ["40", "40kg", "40 kg", "22,5", "22.5kg"]) {
      expect(exibirCarga(valor)).not.toMatch(/kg\s*kg/i);
    }
  });

  it("ignora espaços nas pontas antes de decidir o formato", () => {
    expect(exibirCarga("  40  ")).toBe("40 kg");
  });
});

describe("cargaParaCampoNumerico", () => {
  it("extrai o número de uma carga já numérica", () => {
    expect(cargaParaCampoNumerico("40")).toBe("40");
  });

  it("extrai o número de cargas legadas com unidade colada ou separada", () => {
    expect(cargaParaCampoNumerico("40kg")).toBe("40");
    expect(cargaParaCampoNumerico("40 kg")).toBe("40");
  });

  it("converte vírgula decimal para ponto, formato aceito pelo input numérico", () => {
    expect(cargaParaCampoNumerico("22,5kg")).toBe("22.5");
    expect(cargaParaCampoNumerico("22,5")).toBe("22.5");
  });

  it("volta vazio quando não há número reconhecível", () => {
    expect(cargaParaCampoNumerico("peso corporal")).toBe("");
  });

  it("volta vazio para carga nula, indefinida ou em branco", () => {
    expect(cargaParaCampoNumerico(null)).toBe("");
    expect(cargaParaCampoNumerico(undefined)).toBe("");
    expect(cargaParaCampoNumerico("")).toBe("");
  });
});

describe("fluxo de edição de um registro legado, ponta a ponta", () => {
  it('"40kg" reabre como "40" e volta a exibir "40 kg", sem duplicar a unidade', () => {
    const salvoAntes = "40kg";
    const valorNoCampo = cargaParaCampoNumerico(salvoAntes);
    expect(valorNoCampo).toBe("40");

    // O Personal salva sem alterar o número: o que a API grava é o próprio
    // texto do campo numérico (ver adicionar-exercicio-modal e
    // treino-editor), então a carga persistida vira "40".
    const salvoDepois = valorNoCampo;
    expect(exibirCarga(salvoDepois)).toBe("40 kg");
  });

  it('"40" (sem unidade) reabre como "40" e exibe "40 kg" após salvar', () => {
    const valorNoCampo = cargaParaCampoNumerico("40");
    expect(valorNoCampo).toBe("40");
    expect(exibirCarga(valorNoCampo)).toBe("40 kg");
  });

  it('"40 kg" reabre como "40" e exibe "40 kg" após salvar', () => {
    const valorNoCampo = cargaParaCampoNumerico("40 kg");
    expect(valorNoCampo).toBe("40");
    expect(exibirCarga(valorNoCampo)).toBe("40 kg");
  });
});

describe("formatarCarga (usado pela evolução de carga)", () => {
  it("formata inteiro e decimal no padrão pt-BR", () => {
    expect(formatarCarga(40)).toBe("40 kg");
    expect(formatarCarga(22.5)).toBe("22,5 kg");
  });
});
