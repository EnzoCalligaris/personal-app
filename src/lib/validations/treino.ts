import { z } from "zod";

export const DIAS_SEMANA_VALORES = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

const itemTreinoBase = {
  series: z.coerce.number().int().min(1, "Mínimo de 1 série.").max(20, "Máximo de 20 séries."),
  repeticoes: z.string().trim().min(1, "Informe as repetições.").max(20),
  carga: z.string().trim().max(30).optional().nullable(),
  descansoSeg: z.coerce.number().int().min(0).max(3600).optional().nullable(),
  observacoes: z.string().trim().max(300).optional().nullable(),
};

export const criarTreinoSchema = z.object({
  alunoId: z.uuid("Selecione o aluno."),
  nome: z.string().trim().min(2, "Informe o nome do treino."),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type CriarTreinoInput = z.infer<typeof criarTreinoSchema>;

export const editarTreinoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do treino.").optional(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  ativo: z.boolean().optional(),
  /** Permite transferir o treino para outro aluno do mesmo Personal. */
  alunoId: z.uuid().optional(),
});
export type EditarTreinoInput = z.infer<typeof editarTreinoSchema>;

export const duplicarTreinoSchema = z.object({
  /** Ausente = duplica para o mesmo aluno. */
  alunoId: z.uuid().optional(),
  nome: z.string().trim().min(2).max(120).optional(),
});
export type DuplicarTreinoInput = z.infer<typeof duplicarTreinoSchema>;

export const adicionarExercicioSchema = z.object({
  exercicioId: z.uuid("Selecione o exercício."),
  ...itemTreinoBase,
});
export type AdicionarExercicioInput = z.infer<typeof adicionarExercicioSchema>;

export const editarItemTreinoSchema = z.object({
  series: itemTreinoBase.series.optional(),
  repeticoes: itemTreinoBase.repeticoes.optional(),
  carga: itemTreinoBase.carga,
  descansoSeg: itemTreinoBase.descansoSeg,
  observacoes: itemTreinoBase.observacoes,
});
export type EditarItemTreinoInput = z.infer<typeof editarItemTreinoSchema>;

export const reordenarExerciciosSchema = z.object({
  /** Ids dos itens do treino, já na ordem desejada. */
  itens: z.array(z.uuid()).min(1, "Envie a nova ordem dos exercícios."),
});
export type ReordenarExerciciosInput = z.infer<typeof reordenarExerciciosSchema>;

export const listarTreinosQuerySchema = z.object({
  alunoId: z.uuid().optional(),
  status: z.enum(["ATIVOS", "INATIVOS", "TODOS"]).default("ATIVOS"),
  q: z.string().trim().max(120).optional(),
});
export type ListarTreinosQuery = z.infer<typeof listarTreinosQuerySchema>;
