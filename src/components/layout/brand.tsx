import Link from "next/link";

import { cn } from "@/lib/utils";

/** Símbolo da marca: um "pulso" que remete a batimento/energia. */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M3 12.5h3.2l2-5.5 3.2 11 2.6-8 1.7 4h5.3"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Brand({
  href = "/",
  className,
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      // Sem o wordmark sobra só o símbolo, que é decorativo: sem isto o
      // leitor de tela anuncia apenas "link".
      aria-label={showWordmark ? undefined : "Pulse Training - início"}
      className={cn(
        "flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className
      )}
    >
      <BrandMark />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="font-heading text-lg font-semibold tracking-tight">Pulse</span>
          <span className="text-[0.65rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Training
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export { Brand, BrandMark };
