import { Check, Pencil, Star } from "lucide-react";
import { formatCountdown, timeToMinutes, type DailyFocusDTO } from "@compasso/shared";
import { Button, Card, CardContent, cn } from "@compasso/ui";
import type { CompassBlock } from "../lib/streak";

const STATUS_TEXT = {
  DONE: "Concluída",
  PARTIAL: "Feita em parte",
  SKIPPED: "Não realizada",
} as const;

/**
 * "Sua Única Coisa hoje" no topo da tela Compasso: a resposta da pergunta focal e o bloco dela, com contagem até
 * começar. Sem resposta, mostra o bloco com estrela; sem nada, um convite para definir.
 */
export function FocusCard({
  focus,
  block,
  secondOfDay,
  onEdit,
}: {
  focus: DailyFocusDTO | null;
  /** Bloco da Única Coisa de hoje (escolhido na pergunta ou, sem ela, o de estrela). */
  block: CompassBlock | null;
  secondOfDay: number;
  onEdit: () => void;
}) {
  const answer = focus && !focus.skipped ? focus.answer : null;
  const title = answer ?? block?.title;

  if (!title) {
    return (
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="size-4" aria-hidden /> Qual é a sua Única Coisa hoje?
          </p>
          <Button size="sm" variant="outline" onClick={onEdit}>
            Definir agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  const start = block ? timeToMinutes(block.startTime) * 60 : null;
  const end = block ? timeToMinutes(block.endTime) * 60 : null;
  let when: string | null = null;
  if (block?.log) when = STATUS_TEXT[block.log];
  else if (start !== null && end !== null) {
    if (secondOfDay < start) when = `começa em ${formatCountdown(start - secondOfDay)}`;
    else if (secondOfDay < end) when = "acontecendo agora";
    else when = "o horário já passou";
  }

  return (
    <Card className="border-accent bg-accent/25">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Star className="size-3.5 fill-current" aria-hidden /> Sua Única Coisa hoje
          </p>
          <p className="text-balance font-serif text-2xl leading-tight">{title}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {block ? (
              <>
                {answer && answer !== block.title && <>{block.title} · </>}
                <span className="tabular-nums">
                  {block.startTime}–{block.endTime}
                </span>
                {when && (
                  <>
                    {" · "}
                    <span className={cn("tabular-nums", block.log === "DONE" && "font-medium text-foreground")}>
                      {block.log === "DONE" && <Check className="mr-0.5 inline size-3.5" aria-hidden />}
                      {when}
                    </span>
                  </>
                )}
              </>
            ) : (
              "Sem horário definido"
            )}
          </p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onEdit}>
          <Pencil aria-hidden /> Alterar
        </Button>
      </CardContent>
    </Card>
  );
}
