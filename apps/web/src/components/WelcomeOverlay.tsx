import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@compasso/ui";
import { useAuth } from "../lib/auth";
import { GlassOverlay } from "./GlassOverlay";

const welcomedKey = (userId: string) => `compasso:welcomed:${userId}`;

/**
 * Só em memória: some ao recarregar ou reabrir o app, junto com a liberação de áudio do navegador.
 * Assim a tela volta em toda nova carga, mas não reaparece ao navegar entre as páginas.
 */
let startedThisSession = false;
export const hasStartedThisSession = () => startedThisSession;

function hasWelcomedBefore(userId: string) {
  try {
    return localStorage.getItem(welcomedKey(userId)) !== null;
  } catch {
    return false;
  }
}

function rememberWelcome(userId: string) {
  try {
    localStorage.setItem(welcomedKey(userId), new Date().toISOString());
  } catch {
    // Sem armazenamento, a próxima visita mostra a mensagem de primeiro acesso.
  }
}

/**
 * Tela de entrada que cobre o app até o clique em "Iniciar meu dia". O clique é o gesto que o
 * navegador exige para liberar o som: `onStart` precisa destravar o áudio de forma síncrona.
 */
export function WelcomeOverlay({ onStart, onClosed }: { onStart: () => void; onClosed: () => void }) {
  const { user } = useAuth();
  // Lido uma vez: depois do clique a mensagem não muda durante o fade-out.
  const [returning] = useState(() => (user ? hasWelcomedBefore(user.id) : false));
  const firstName = user?.name.trim().split(/\s+/)[0];
  const [leaving, setLeaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const start = () => {
    if (leaving) return;
    onStart(); // ainda dentro do clique
    startedThisSession = true;
    if (user) rememberWelcome(user.id);
    setLeaving(true);
  };

  const greeting = returning && firstName ? `Que bom ter você de volta, ${firstName}!` : "Boas-vindas ao Compasso.";
  const message = returning
    ? "Cada novo dia é uma oportunidade de avançar. Vamos continuar no seu ritmo?"
    : "Organize seu tempo, mantenha o ritmo e avance em direção às suas metas.";

  return (
    <GlassOverlay
      leaving={leaving}
      onClosed={onClosed}
      initialFocus={buttonRef}
      labelledBy="welcome-title"
      describedBy="welcome-message"
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
        <img src="/icon.svg" alt="" className="size-12" />
        <div className="flex flex-col gap-3">
          <h1 id="welcome-title" className="text-balance font-serif text-4xl md:text-5xl">
            {greeting}
          </h1>
          <p id="welcome-message" className="text-balance text-base text-muted-foreground md:text-lg">
            {message}
          </p>
        </div>
        <Button
          ref={buttonRef}
          size="lg"
          onClick={start}
          className="mt-2 rounded-full px-8 shadow-soft transition-[transform,background-color] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] has-[>svg]:px-7"
        >
          <Play aria-hidden className="fill-current" /> Iniciar meu dia
        </Button>
      </div>
    </GlassOverlay>
  );
}
