"use client";

import { cn } from "@/lib/utils";
import { formatarDataCalendario } from "@/lib/format";

export type PontoEvolucao = { data: string; valor: number };

/**
 * Gráfico de linha em SVG puro - sem biblioteca de charts.
 *
 * A linha e a área usam `preserveAspectRatio="none"` para esticar até a
 * largura do container; os pontos ficam em elementos HTML posicionados por
 * porcentagem, senão o mesmo esticamento os transformaria em elipses.
 */
export function GraficoEvolucao({
  pontos,
  unidade = "",
  rotulo,
}: {
  pontos: PontoEvolucao[];
  unidade?: string;
  rotulo: string;
}) {
  if (pontos.length === 0) return null;

  const valores = pontos.map((ponto) => ponto.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Uma faixa mínima evita que uma variação de 200 g vire um pico dramático.
  const amplitude = Math.max(maximo - minimo, Math.abs(maximo) * 0.04, 1);
  const base = (minimo + maximo) / 2 - amplitude / 2;

  // Sistema de coordenadas em porcentagem: serve tanto para o SVG (viewBox
  // 0..100) quanto para posicionar os pontos em CSS.
  const margemY = 10;
  const px = (indice: number) =>
    pontos.length === 1 ? 50 : (indice / (pontos.length - 1)) * 100;
  const py = (valor: number) =>
    100 - margemY - ((valor - base) / amplitude) * (100 - margemY * 2);

  const coordenadas = pontos.map((ponto, indice) => ({
    ...ponto,
    x: px(indice),
    y: py(ponto.valor),
  }));

  const linha = coordenadas.map((ponto) => `${ponto.x},${ponto.y}`).join(" ");
  const area = `0,100 ${linha} 100,100`;
  const ultimo = coordenadas.at(-1)!;
  const idGradiente = `evolucao-${rotulo.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">
        {rotulo}: de {pontos[0].valor} a {ultimo.valor} {unidade}
      </figcaption>

      <div className="relative h-40 w-full px-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full"
          role="img"
          aria-label={`Evolução de ${rotulo.toLowerCase()}`}
        >
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[margemY, 50, 100 - margemY].map((posicao) => (
            <line
              key={posicao}
              x1="0"
              x2="100"
              y1={posicao}
              y2={posicao}
              stroke="var(--color-border)"
              strokeDasharray="3 4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {pontos.length > 1 ? <polygon points={area} fill={`url(#${idGradiente})`} /> : null}

          <polyline
            points={linha}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Pontos em HTML: círculos de verdade, sem distorção. */}
        {coordenadas.map((ponto, indice) => (
          <span
            key={ponto.data}
            title={`${formatarDataCalendario(ponto.data)}: ${ponto.valor.toLocaleString("pt-BR")}${unidade}`}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-primary bg-background",
              indice === coordenadas.length - 1 ? "size-3" : "size-2.5"
            )}
            style={{ left: `${ponto.x}%`, top: `${ponto.y}%` }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground tabular-nums">
        <span>{formatarDataCalendario(pontos[0].data)}</span>
        <span>
          {ultimo.valor.toLocaleString("pt-BR")}
          {unidade} · {formatarDataCalendario(ultimo.data)}
        </span>
      </div>
    </figure>
  );
}
