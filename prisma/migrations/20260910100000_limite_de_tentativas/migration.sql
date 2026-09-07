-- Contador de tentativas das rotas de autenticação.
--
-- Login, cadastro e recuperação de senha aceitavam chamadas sem limite: força
-- bruta de senha, criação automatizada de contas e disparo de e-mail contra
-- qualquer endereço.
--
-- O contador precisa ser compartilhado entre as instâncias - a imagem de
-- produção é `standalone` e pode subir replicada, e um contador em memória
-- daria a cada réplica o seu próprio limite. O banco já é o estado
-- compartilhado da aplicação, então não entra infraestrutura nova.
--
-- A chave é opaca: escopo + hash do IP ou do e-mail. A tabela registra
-- tentativas de endereços que podem nem existir (na recuperação, qualquer um),
-- e guardar o texto puro a transformaria numa lista de endereços sondados.

CREATE TABLE "rate_limits" (
    "chave" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "janelaFim" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("chave")
);

-- A limpeza das janelas vencidas varre por data.
CREATE INDEX "rate_limits_janelaFim_idx" ON "rate_limits"("janelaFim");
