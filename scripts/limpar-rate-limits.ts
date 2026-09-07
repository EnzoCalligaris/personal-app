import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * Apaga as janelas de tentativa já vencidas da tabela `rate_limits`.
 *
 * Uma chave só é reaproveitada por quem volta a tentar: o endereço que errou a
 * senha uma vez e nunca mais voltou deixa a linha lá para sempre. Nada quebra
 * por causa disso - a janela vencida é reiniciada no próximo uso, e apagá-la dá
 * exatamente no mesmo -, mas a tabela cresce sem teto com o tempo.
 *
 * POR QUE UM SCRIPT, E NÃO UMA LIMPEZA DENTRO DA REQUISIÇÃO
 *
 * Varrer a tabela a cada login colocaria um DELETE no caminho de quem está
 * tentando entrar, para resolver um problema que não é dele. Fazê-lo de vez em
 * quando, por sorteio, esconderia o custo sem eliminá-lo e deixaria o
 * comportamento dependente do tráfego. Aqui a limpeza é uma tarefa de operação,
 * como `db:deploy` e `db:seed` - roda quando o operador mandar.
 *
 * POR QUE É SEGURO RODAR COM VÁRIAS INSTÂNCIAS
 *
 * O `DELETE` decide linha a linha pelo `janelaFim`, avaliado no momento em que
 * a linha é travada. Uma tentativa que chegue durante a limpeza renova o
 * `janelaFim` para o futuro, e a linha deixa de casar com a condição - não é
 * apagada. E apagar uma linha vencida é invisível para o contador: com ou sem
 * ela, a próxima tentativa começa do um. Por isso duas execuções simultâneas
 * também não se atrapalham; basta um agendador chamando periodicamente.
 *
 * A varredura usa o índice `rate_limits_janelaFim_idx`, criado junto com a
 * tabela.
 */
export async function limparExpirados(antesDe: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { janelaFim: { lt: antesDe } },
  });
  return count;
}

async function main() {
  const antes = await prisma.rateLimit.count();
  const removidas = await limparExpirados();
  const depois = await prisma.rateLimit.count();

  console.log(
    `rate_limits: ${removidas} janela(s) vencida(s) removida(s); ` +
      `${depois} de ${antes} linha(s) continuam valendo.`
  );
}

/** Só executa quando chamado como script - importar daqui não apaga nada. */
const chamadoDireto = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("scripts/limpar-rate-limits.ts");

if (chamadoDireto) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
