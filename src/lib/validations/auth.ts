import { z } from "zod";

export const registroSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.email("E-mail inválido."),
  // O bcrypt do Supabase Auth trunca em 72 bytes: acima disso o limite não
  // acrescenta segurança, só aceita corpo grande à toa.
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "Senha muito longa."),
  role: z.enum(["PERSONAL", "ALUNO"], { message: "Selecione o tipo de conta." }),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha.").max(72, "Senha muito longa."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const esqueciSenhaSchema = z.object({
  email: z.email("E-mail inválido."),
});
export type EsqueciSenhaInput = z.infer<typeof esqueciSenhaSchema>;

export const redefinirSenhaSchema = z.object({
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "Senha muito longa."),
});
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
