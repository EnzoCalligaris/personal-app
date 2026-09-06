import { z } from "zod";

/**
 * Nenhuma medida é obrigatória. O formulário manda string vazia para o que não
 * foi preenchido, e o `preprocess` transforma isso em `null` - o campo fica
 * sem valor em vez de virar zero.
 */
function medida(min: number, max: number, unidade?: string) {
  return z.preprocess(
    (valor) => (valor === "" || valor === undefined ? null : valor),
    z.coerce
      .number()
      .min(min, unidade ? `Valor fora do esperado (${unidade}).` : "Valor fora do esperado.")
      .max(max, unidade ? `Valor fora do esperado (${unidade}).` : "Valor fora do esperado.")
      .nullable()
  );
}

function inteiro(min: number, max: number) {
  return z.preprocess(
    (valor) => (valor === "" || valor === undefined ? null : valor),
    z.coerce.number().int().min(min).max(max).nullable()
  );
}

const camposDeMedida = {
  peso: medida(20, 400, "kg"),
  imc: medida(5, 90),
  percentualGordura: medida(1, 80, "%"),
  massaGorda: medida(0.1, 200, "kg"),
  massaMagra: medida(1, 200, "kg"),
  massaMuscular: medida(1, 200, "kg"),
  massaOssea: medida(0.1, 20, "kg"),
  aguaPercentual: medida(1, 90, "%"),
  aguaLitros: medida(1, 120, "L"),
  gorduraVisceral: medida(1, 60),
  metabolismoBasal: inteiro(500, 6000),
  idadeMetabolica: inteiro(5, 120),
};

/** Circunferências, em centímetros. */
const medidasCorporais = z
  .record(z.string().trim().min(1).max(30), z.coerce.number().min(1).max(300))
  .optional()
  .nullable();

export const criarAvaliacaoSchema = z.object({
  alunoId: z.uuid("Selecione o aluno."),
  data: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.")
    .optional(),
  ...camposDeMedida,
  observacoes: z.string().trim().max(1000).optional().nullable(),
  medidas: medidasCorporais,
});
export type CriarAvaliacaoInput = z.infer<typeof criarAvaliacaoSchema>;

/** Na edição o aluno não muda - corrigir a avaliação é corrigir as medidas. */
export const editarAvaliacaoSchema = criarAvaliacaoSchema.omit({ alunoId: true }).partial();
export type EditarAvaliacaoInput = z.infer<typeof editarAvaliacaoSchema>;

export const listarAvaliacoesQuerySchema = z.object({
  alunoId: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
});
export type ListarAvaliacoesQuery = z.infer<typeof listarAvaliacoesQuerySchema>;
