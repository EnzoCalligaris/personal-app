/**
 * Carga é texto livre na ficha ("40kg", "20 kg cada", "peso corporal"), porque
 * é assim que o Personal escreve. Para desenhar evolução, é preciso extrair um
 * número - e admitir que nem toda carga tem um.
 */
export function cargaEmKg(carga: string | null | undefined): number | null {
  if (!carga) return null;

  const texto = carga.toLowerCase().replace(",", ".");
  const numero = texto.match(/\d+(?:\.\d+)?/);
  if (!numero) return null;

  const valor = Number(numero[0]);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  // Libras aparecem em ficha de academia importada; o gráfico é sempre em kg.
  if (/\blb|libra/.test(texto)) return Math.round(valor * 0.4536 * 10) / 10;

  return valor;
}

/** 27 -> "27 kg"; 27.5 -> "27,5 kg". */
export function formatarCarga(kg: number) {
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

/** Um valor é "só o número" quando não carrega nenhuma unidade ou anotação. */
const SO_NUMERO = /^\d+(?:[.,]\d+)?$/;

/**
 * Para exibir a carga na ficha: quem digitou só o número ("40") ganha o
 * sufixo "kg" ("40 kg"). Carga que já veio com unidade ou anotação própria
 * ("40kg", "peso corporal", "20kg cada") é mostrada como foi salva - nunca
 * duplicamos o sufixo por cima do que o Personal já escreveu.
 */
export function exibirCarga(carga: string): string {
  const texto = carga.trim();
  if (SO_NUMERO.test(texto)) return formatarCarga(Number(texto.replace(",", ".")));
  return texto;
}

/**
 * Para reabrir o campo numérico de carga na edição: extrai o número de uma
 * carga salva em qualquer formato ("40", "40kg", "40 kg", "22,5") para
 * preencher o input sem repetir a unidade. Carga sem número reconhecível
 * (ex.: "peso corporal") volta vazia - o Personal informa um valor novo.
 */
export function cargaParaCampoNumerico(carga: string | null | undefined): string {
  if (!carga) return "";
  const numero = carga.trim().replace(",", ".").match(/^\d+(?:\.\d+)?/);
  return numero ? numero[0] : "";
}
