import { z } from "zod";

/** Data no formato yyyy-mm-dd (input type="date") ou vazio. */
const dataOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === "" || !Number.isNaN(Date.parse(valor)), "Data inválida.")
  .optional()
  .nullable();

const telefone = z
  .string()
  .trim()
  .max(20, "Telefone muito longo.")
  .optional()
  .nullable();

export const criarAlunoSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("E-mail inválido."),
  phone: telefone,
  dataNascimento: dataOpcional,
  altura: z.coerce.number().positive("Altura deve ser positiva.").max(300).optional().nullable(),
  objetivo: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type CriarAlunoInput = z.infer<typeof criarAlunoSchema>;

export const editarAlunoSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo.").optional(),
  phone: telefone,
  dataNascimento: dataOpcional,
  altura: z.coerce.number().positive("Altura deve ser positiva.").max(300).optional().nullable(),
  objetivo: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
});
export type EditarAlunoInput = z.infer<typeof editarAlunoSchema>;

export const listarAlunosQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ATIVO", "INATIVO", "TODOS"]).default("TODOS"),
  ordenar: z.enum(["recentes", "nome"]).default("recentes"),
});
export type ListarAlunosQuery = z.infer<typeof listarAlunosQuerySchema>;
