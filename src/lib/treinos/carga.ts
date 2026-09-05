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
