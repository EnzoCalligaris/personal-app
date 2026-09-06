import "server-only";

import { prisma } from "@/lib/prisma";
import {
  dataDoInstante,
  intervaloDeDatas,
  paraISO,
  somarDiasUTC,
} from "@/lib/date-utils";
import { treinosPrevistosPara } from "@/lib/programacoes/queries";
import { cargaEmKg } from "@/lib/treinos/carga";
import type {
  EvolucaoExercicio,
  PontoDeCarga,
  ProgressoResponse,
  SemanaDeTreino,
} from "@/types/aluno-area";

/** Semanas mostradas no gráfico de frequência. */
const SEMANAS_FREQUENCIA = 12;
/** Janela usada para previsto x realizado. */
const SEMANAS_ADERENCIA = 4;
/** Até onde olhar para trás ao calcular sequências. */
const JANELA_SEQUENCIA_DIAS = 180;

/**
 * Evolução dos treinos do próprio aluno: frequência, sequência e a progressão
 * de carga por exercício.
 *
 * Tudo sai do que foi de fato registrado (`historico_treinos` e
 * `historico_exercicios`). Quando não há dado, a resposta vem vazia - a tela
 * mostra o estado vazio em vez de inventar um gráfico.
 */
export async function meuProgresso(
  alunoId: string,
  agora: Date = new Date()
): Promise<ProgressoResponse> {
  const hoje = dataDoInstante(agora);
  const inicioSemanaAtual = somarDiasUTC(hoje, -hoje.getUTCDay());
  const inicioJanelaSemanas = somarDiasUTC(inicioSemanaAtual, -7 * (SEMANAS_FREQUENCIA - 1));
  const inicioJanelaSequencia = somarDiasUTC(hoje, -JANELA_SEQUENCIA_DIAS);
  const inicioDaBusca = inicioJanelaSemanas < inicioJanelaSequencia ? inicioJanelaSemanas : inicioJanelaSequencia;

  const [execucoes, totalConcluidos, primeira] = await Promise.all([
    prisma.historicoTreino.findMany({
      where: { alunoId, dataExecucao: { gte: inicioDaBusca } },
      select: { dataExecucao: true, concluido: true },
      orderBy: { dataExecucao: "asc" },
    }),
    prisma.historicoTreino.count({ where: { alunoId, concluido: true } }),
    prisma.historicoTreino.findFirst({
      where: { alunoId },
      orderBy: { dataExecucao: "asc" },
      select: { dataExecucao: true },
    }),
  ]);

  const datasExecutadas = new Set(
    execucoes.map((item) => paraISO(dataDoInstante(item.dataExecucao)))
  );

  // Um só levantamento de programação cobre frequência, aderência e sequência.
  // A janela vai até o fim da semana corrente: os dias que ainda vêm também
  // estão programados, e a barra da semana precisa mostrá-los.
  const fimDaJanela = somarDiasUTC(inicioSemanaAtual, 6);
  const datasDaJanela = intervaloDeDatas(inicioDaBusca, fimDaJanela);
  const previstos = await treinosPrevistosPara(
    datasDaJanela.map((data) => ({ alunoId, data }))
  );
  const ehDiaDeTreino = (iso: string) => previstos.get(`${alunoId}:${iso}`)?.tipo === "TREINO";

  const semanas = montarSemanas(inicioSemanaAtual, datasExecutadas, ehDiaDeTreino);
  const aderencia = calcularAderencia(semanas);

  const { atual, melhor } = calcularSequencias(
    intervaloDeDatas(inicioJanelaSequencia, hoje),
    datasExecutadas,
    ehDiaDeTreino,
    paraISO(hoje)
  );

  return {
    resumo: {
      totalConcluidos,
      naSemana: semanas.at(-1)?.realizados ?? 0,
      frequenciaSemanal: mediaSemanal(semanas, primeira?.dataExecucao ?? null),
      sequenciaAtual: atual,
      melhorSequencia: melhor,
      aderencia,
      primeiroTreino: primeira?.dataExecucao.toISOString() ?? null,
    },
    semanas,
    exercicios: await evolucaoPorExercicio(alunoId),
  };
}

/* -------------------------------------------------------------------------
   Frequência
   ------------------------------------------------------------------------- */

function montarSemanas(
  inicioSemanaAtual: Date,
  datasExecutadas: Set<string>,
  ehDiaDeTreino: (iso: string) => boolean
): SemanaDeTreino[] {
  const semanas: SemanaDeTreino[] = [];

  for (let indice = SEMANAS_FREQUENCIA - 1; indice >= 0; indice--) {
    const inicio = somarDiasUTC(inicioSemanaAtual, -7 * indice);
    const fim = somarDiasUTC(inicio, 6);
    const dias = intervaloDeDatas(inicio, fim).map(paraISO);

    semanas.push({
      inicio: paraISO(inicio),
      fim: paraISO(fim),
      realizados: dias.filter((iso) => datasExecutadas.has(iso)).length,
      previstos: dias.filter(ehDiaDeTreino).length,
    });
  }

  return semanas;
}

/** Previsto x realizado nas últimas semanas (ignora quem não tem programação). */
function calcularAderencia(semanas: SemanaDeTreino[]) {
  const recentes = semanas.slice(-SEMANAS_ADERENCIA);
  const previstos = recentes.reduce((total, semana) => total + semana.previstos, 0);
  if (previstos === 0) return null;

  return {
    previstos,
    realizados: recentes.reduce((total, semana) => total + semana.realizados, 0),
  };
}

/**
 * Média de treinos por semana. Só conta as semanas a partir do primeiro treino
 * registrado: quem começou há duas semanas não deve aparecer com a média
 * diluída por doze.
 */
function mediaSemanal(semanas: SemanaDeTreino[], primeiroTreino: Date | null) {
  if (!primeiroTreino) return 0;

  const inicio = paraISO(dataDoInstante(primeiroTreino));
  const consideradas = semanas.filter((semana) => semana.fim >= inicio);
  if (consideradas.length === 0) return 0;

  const total = consideradas.reduce((soma, semana) => soma + semana.realizados, 0);
  return Math.round((total / consideradas.length) * 10) / 10;
}

/* -------------------------------------------------------------------------
   Sequência
   ------------------------------------------------------------------------- */

/**
 * Sequência = dias de treino seguidos, sem furo. Descanso e dias sem
 * programação não quebram (não havia treino a fazer); o dia de hoje ainda não
 * treinado também não, porque o dia não acabou.
 */
function calcularSequencias(
  datas: Date[],
  datasExecutadas: Set<string>,
  ehDiaDeTreino: (iso: string) => boolean,
  hojeISO: string
) {
  let melhor = 0;
  let corrente = 0;

  for (const data of datas) {
    const iso = paraISO(data);
    if (!ehDiaDeTreino(iso)) continue;

    if (datasExecutadas.has(iso)) {
      corrente += 1;
      melhor = Math.max(melhor, corrente);
      continue;
    }
    if (iso === hojeISO) continue;
    corrente = 0;
  }

  // `corrente` termina no dia de hoje: é exatamente a sequência atual.
  return { atual: corrente, melhor };
}

/* -------------------------------------------------------------------------
   Evolução por exercício
   ------------------------------------------------------------------------- */

export async function evolucaoPorExercicio(alunoId: string): Promise<EvolucaoExercicio[]> {
  const registros = await prisma.historicoExercicio.findMany({
    where: { historico: { alunoId }, concluido: true },
    select: {
      exercicioId: true,
      nome: true,
      grupoMuscular: true,
      series: true,
      repeticoes: true,
      carga: true,
      historico: { select: { dataExecucao: true } },
    },
    orderBy: { historico: { dataExecucao: "asc" } },
  });

  // Agrupa pelo exercício da biblioteca; sem vínculo (exercício excluído),
  // o nome registrado é a chave.
  const grupos = new Map<string, { nome: string; grupoMuscular: string; pontos: PontoDeCarga[] }>();

  for (const registro of registros) {
    const chave = registro.exercicioId ?? `nome:${registro.nome.toLowerCase()}`;
    const grupo = grupos.get(chave) ?? {
      nome: registro.nome,
      grupoMuscular: registro.grupoMuscular,
      pontos: [],
    };

    const data = paraISO(dataDoInstante(registro.historico.dataExecucao));
    const kg = cargaEmKg(registro.carga);
    const existente = grupo.pontos.find((ponto) => ponto.data === data);

    if (existente) {
      // Duas entradas no mesmo dia: fica a de maior carga.
      if (kg !== null && (existente.cargaKg === null || kg > existente.cargaKg)) {
        existente.carga = registro.carga;
        existente.cargaKg = kg;
        existente.series = registro.series;
        existente.repeticoes = registro.repeticoes;
      }
    } else {
      grupo.pontos.push({
        data,
        carga: registro.carga,
        cargaKg: kg,
        series: registro.series,
        repeticoes: registro.repeticoes,
      });
    }

    grupo.nome = registro.nome;
    grupos.set(chave, grupo);
  }

  const exercicios: EvolucaoExercicio[] = [...grupos.entries()].map(([chave, grupo]) => {
    const comCarga = grupo.pontos.filter((ponto) => ponto.cargaKg !== null);
    const cargaInicial = comCarga[0]?.cargaKg ?? null;
    const cargaAtual = comCarga.at(-1)?.cargaKg ?? null;

    const variacaoKg =
      cargaInicial !== null && cargaAtual !== null
        ? Math.round((cargaAtual - cargaInicial) * 10) / 10
        : null;

    return {
      chave,
      nome: grupo.nome,
      grupoMuscular: grupo.grupoMuscular,
      sessoes: grupo.pontos.length,
      registros: grupo.pontos,
      cargaInicial,
      cargaAtual,
      cargaMaxima: comCarga.length
        ? Math.max(...comCarga.map((ponto) => ponto.cargaKg!))
        : null,
      variacaoKg,
      variacaoPercentual:
        variacaoKg !== null && cargaInicial
          ? Math.round((variacaoKg / cargaInicial) * 1000) / 10
          : null,
      // Um ponto só é um dado, não uma evolução.
      temGrafico: comCarga.length >= 2,
    };
  });

  return exercicios.sort(
    (a, b) => b.sessoes - a.sessoes || a.nome.localeCompare(b.nome, "pt-BR")
  );
}
