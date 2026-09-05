/**
 * Duração estimada de um treino, em minutos.
 *
 * Não há cronômetro no sistema ainda, então a estimativa é aritmética: cada
 * série custa o tempo de execução mais o descanso configurado (ou o padrão,
 * quando o Personal não definiu). O último descanso de cada exercício conta
 * como transição para o próximo, então não é descontado.
 */
const SEGUNDOS_POR_SERIE = 45;
const DESCANSO_PADRAO_SEG = 60;
/** Aquecimento + preparo dos aparelhos. */
const SOBRECARGA_MIN = 5;

export function duracaoEstimadaMin(
  exercicios: { series: number; descansoSeg: number | null }[]
): number {
  if (exercicios.length === 0) return 0;

  const segundos = exercicios.reduce(
    (total, item) =>
      total + item.series * (SEGUNDOS_POR_SERIE + (item.descansoSeg ?? DESCANSO_PADRAO_SEG)),
    0
  );

  const minutos = SOBRECARGA_MIN + segundos / 60;

  // Arredonda para múltiplos de 5: uma estimativa com precisão de minuto
  // passaria uma exatidão que ela não tem.
  return Math.max(10, Math.round(minutos / 5) * 5);
}

/** 50 -> "50 min"; 75 -> "1h15". */
export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}
