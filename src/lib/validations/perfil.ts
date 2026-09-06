import { z } from "zod";

/** Dados que qualquer usuário pode alterar no próprio cadastro. */
const telefone = z
  .string()
  .trim()
  .max(20, "Telefone muito longo.")
  .refine(
    (valor) => valor === "" || /^[\d\s()+-]{8,20}$/.test(valor),
    "Use apenas números, espaços e os sinais ( ) + -."
  )
  .optional()
  .nullable();

export const editarMeuPerfilPersonalSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo.").optional(),
  telefone,
  cref: z.string().trim().max(30, "CREF muito longo.").optional().nullable(),
  bio: z.string().trim().max(500, "Máximo de 500 caracteres.").optional().nullable(),
});
export type EditarMeuPerfilPersonalInput = z.infer<typeof editarMeuPerfilPersonalSchema>;
