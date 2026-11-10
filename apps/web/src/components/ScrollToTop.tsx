import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** A partir desta rolagem o botão aparece; no topo da página ele não teria o que fazer. */
const SHOW_AFTER_PX = 240;

/** Botão flutuante no canto inferior direito que volta ao topo da página. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;

  const scrollUp = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollUp}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      // No celular fica acima da navegação inferior.
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-11 cursor-pointer items-center justify-center rounded-full border bg-card text-foreground shadow-soft transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:bottom-6 md:right-6"
    >
      <ArrowUp aria-hidden className="size-5" />
    </button>
  );
}
