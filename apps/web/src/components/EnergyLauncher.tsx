import { useState } from "react";
import { BatteryMedium, CircleHelp } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@compasso/ui";
import { zonedNow } from "../lib/time";

/** Hora cheia (data + hora) de um instante no fuso do perfil. */
function hourSlot(epochMs: number, timezone: string) {
  const { date, secondOfDay } = zonedNow(epochMs, timezone);
  return { date, hour: Math.floor(secondOfDay / 3600) };
}

/**
 * Card para registrar a energia na hora, sem esperar a pergunta sorteada. Depois de um registro, só libera
 * de novo na próxima hora cheia (a mesma regra da API).
 */
export function EnergyLauncher({
  lastAt,
  now,
  timezone,
  onStart,
}: {
  lastAt: number | null;
  now: number;
  timezone: string;
  onStart: () => void;
}) {
  const current = hourSlot(now, timezone);
  const last = lastAt !== null ? hourSlot(lastAt, timezone) : null;
  const recordedThisHour = last !== null && last.date === current.date && last.hour === current.hour;
  const nextHour = `${String((current.hour + 1) % 24).padStart(2, "0")}:00`;
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <Card className="relative bg-primary/20">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3"
        onClick={() => setInfoOpen(true)}
        aria-label="Curiosidade: por que avaliar sua energia"
        title="Curiosidade"
      >
        <CircleHelp aria-hidden />
      </Button>
      <EnergyInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pr-10">
          <BatteryMedium className="size-5" aria-hidden /> Nível de energia
        </CardTitle>
        <CardDescription>
          Registre agora como está sua disposição, sem esperar a próxima pergunta. As respostas montam o gráfico de
          energia por hora do Analytics.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button size="lg" variant="outline" onClick={onStart} disabled={recordedThisHour}>
          Avaliar minha energia
        </Button>
        {recordedThisHour && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Energia registrada nesta hora. Nova avaliação a partir das {nextHour}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Por que registrar a energia: usar os picos do dia para encaixar os blocos que mais exigem. */
function EnergyInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Por que avaliar sua energia?</DialogTitle>
          <DialogDescription>Seu dia rende mais quando a agenda acompanha a sua disposição.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            A energia mental não é a mesma o dia inteiro: há horas em que o foco vem fácil e outras em que até uma tarefa
            simples pesa. Registrar como você está, em momentos diferentes, mostra quando costumam ser os seus picos e as
            suas quedas.
          </p>
          <p>
            Com essas respostas, o gráfico de energia por hora do Analytics ajuda você a decidir onde encaixar cada
            prioridade. Reserve os horários de maior energia para os blocos mais importantes ou que pedem mais foco e
            atenção, como estudo, escrita ou aquela tarefa que você vem adiando.
          </p>
          <p>
            Já os horários de energia mais baixa combinam com atividades leves e rotineiras, como responder mensagens,
            organizar o dia ou fazer pausas. Quanto mais avaliações você fizer, mais fiel fica o retrato do seu ritmo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
