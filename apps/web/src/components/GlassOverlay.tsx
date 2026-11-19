import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@compasso/ui";

/** Duração do fade-out; a classe `duration-500` abaixo usa o mesmo valor. */
const EXIT_MS = 500;

/**
 * Camada de vidro fosco que cobre o app inteiro (boas-vindas, registro de energia). Enquanto está ativa,
 * o app ao fundo não recebe foco, cliques nem rolagem. Com `leaving`, some em fade-out e chama `onClosed`.
 */
export function GlassOverlay({
  leaving,
  onClosed,
  initialFocus,
  labelledBy,
  describedBy,
  children,
}: {
  leaving: boolean;
  onClosed: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const closed = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    if (leaving) return;
    const root = document.getElementById("root");
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    root?.setAttribute("inert", "");
    html.style.overflow = "hidden";
    initialFocus?.current?.focus();
    return () => {
      root?.removeAttribute("inert");
      html.style.overflow = previousOverflow;
    };
  }, [leaving, initialFocus]);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClosedRef.current();
  };

  // Garantia caso o navegador não dispare o fim da animação. Sem dependências além de `leaving`:
  // a página ao fundo renderiza a cada segundo e não pode reiniciar este prazo.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(close, EXIT_MS + 150);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) close();
      }}
      className={cn(
        "fixed inset-0 z-[60] flex h-dvh w-screen items-center justify-center overflow-y-auto bg-background/55 px-6 py-8 backdrop-blur-md duration-500",
        leaving ? "pointer-events-none animate-out fade-out fill-mode-forwards" : "animate-in fade-in",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
