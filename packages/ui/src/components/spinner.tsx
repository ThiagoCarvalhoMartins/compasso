import * as React from "react";
import { cn } from "../lib/utils";

const SPOKES = 8;

/** Indicador de atividade no estilo iOS: raios que esmaecem, girando em passos. Decorativo; sinalize o estado com aria-busy no elemento pai. */
export function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden
      className={cn("size-4 animate-spinner motion-reduce:animate-none", className)}
      {...props}
    >
      {Array.from({ length: SPOKES }, (_, i) => {
        // O raio mais forte lidera o giro horário; os anteriores formam o rastro.
        const stepsBehindHead = (SPOKES - i) % SPOKES;
        return (
          <line
            key={i}
            x1="12"
            y1="3"
            x2="12"
            y2="7.5"
            transform={`rotate(${(i * 360) / SPOKES} 12 12)`}
            opacity={1 - (stepsBehindHead * 0.75) / (SPOKES - 1)}
          />
        );
      })}
    </svg>
  );
}
