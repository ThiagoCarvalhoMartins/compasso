import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarRange,
  Fingerprint,
  Layers,
  Pencil,
  Plus,
  Quote,
  Repeat,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { dateRange, microHabitSchema, type BlockDTO, type MicroHabitDTO } from "@compasso/shared";
import {
  ApiError,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Progress,
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { WEEKDAY_LABELS, formatShortDate, zonedNow } from "../lib/time";

/** Sugestões para o primeiro micro-hábito: começar com algo que leve menos de 2 minutos. */
const SUGGESTIONS = [
  { title: "Ler uma página", identity: "lê todos os dias" },
  { title: "Fazer 5 flexões", identity: "cuida do próprio corpo" },
  { title: "Estudar por 5 minutos", identity: "estuda continuamente" },
  { title: "Guardar um objeto no lugar", identity: "mantém a casa organizada" },
  { title: "Beber um copo de água", identity: "cuida da própria saúde" },
];

/** Os primeiros 66 dias, em fases: uma sugestão prática, não uma regra. */
const PHASES = [
  { from: 1, to: 7, title: "Comece muito pequeno", text: "Uma ação tão simples que seja difícil achar desculpa." },
  { from: 8, to: 21, title: "Repita sem aumentar", text: "Faça todos os dias, sem deixar mais difícil." },
  { from: 22, to: 45, title: "Consolide a rotina", text: "A resistência para começar vai diminuindo." },
  { from: 46, to: 66, title: "Avalie crescer aos poucos", text: "Se já está confortável, aumente um pouco." },
  { from: 67, to: Infinity, title: "Mantenha e evolua", text: "Agora é parte de quem você é." },
];
const HABIT_DAYS = 66;

const phaseOf = (day: number) => PHASES.find((p) => day <= p.to) ?? PHASES[PHASES.length - 1];

/** Quando o bloco acontece, em poucas palavras. */
function whenLabel(b: BlockDTO) {
  if (b.recurrence === "ONCE") return b.date ? formatShortDate(b.date) : "";
  if (b.repeatWeekdays.length === 7) return "todos os dias";
  if (b.repeatWeekdays.join() === "1,2,3,4,5") return "dias úteis";
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => b.repeatWeekdays.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

type Draft = { id?: string; title: string; identity: string };

/** Empilhamento de hábitos (Hábitos Atômicos): micro-hábitos feitos logo depois de um bloco da agenda. */
export function AtomicPage() {
  const { user } = useAuth();
  const today = zonedNow(Date.now(), user?.timezone ?? "America/Sao_Paulo").date;
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ["micro-habits"],
    queryFn: () => api.get<MicroHabitDTO[]>("/micro-habits"),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api.get<BlockDTO[]>("/blocks"),
  });
  // Séries já encerradas não contam como empilhamento ativo.
  const activeBlocks = blocks.filter((b) => (b.recurrence === "ONCE" ? b.date! >= today : !b.endsOn || b.endsOn >= today));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl">Atomic</h1>
          <p className="mt-1.5 text-balance text-muted-foreground">
            Você não precisa começar fazendo muito. Precisa começar fazendo algo que consiga repetir.
          </p>
        </div>
        <Button onClick={() => setDraft({ title: "", identity: "" })}>
          <Plus aria-hidden /> Novo micro-hábito
        </Button>
      </div>

      <section aria-labelledby="habits-title" className="flex flex-col gap-3">
        <h2 id="habits-title" className="text-xl">
          Seus micro-hábitos
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : habits.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Escolha uma ação que leve menos de 2 minutos e empilhe depois de um bloco que já existe na sua agenda.
                Que tal começar por uma destas?
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s.title} variant="outline" size="sm" onClick={() => setDraft(s)}>
                    {s.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {habits.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                blocks={activeBlocks.filter((b) => h.blockIds.includes(b.id))}
                today={today}
                onEdit={() => setDraft({ id: h.id, title: h.title, identity: h.identity ?? "" })}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="tips-title" className="flex flex-col gap-3">
        <h2 id="tips-title" className="text-xl">
          Para lembrar
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TipCard icon={<TrendingUp />} title="1% melhor a cada dia">
            <p>Pequenas melhorias se acumulam como juros compostos. Ao longo de um ano:</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-primary/30 p-2">
                <p className="font-serif text-2xl tabular-nums text-foreground">37,8×</p>
                <p className="text-xs">melhorando 1% ao dia</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="font-serif text-2xl tabular-nums text-foreground">0,03×</p>
                <p className="text-xs">piorando 1% ao dia</p>
              </div>
            </div>
            <p className="mt-2 text-xs">É uma ilustração, não uma promessa de evolução linear.</p>
          </TipCard>

          <TipCard icon={<Timer />} title="A regra dos dois minutos">
            <p>Todo hábito novo começa com uma versão que leve menos de dois minutos:</p>
            <ul className="mt-2 flex flex-col gap-1">
              <li>Ler todos os dias → ler uma página</li>
              <li>Correr → calçar o tênis de corrida</li>
              <li>Estudar → abrir o material de estudo</li>
              <li>Academia → vestir a roupa de treino</li>
            </ul>
            <p className="mt-2 text-xs">Os dois minutos são a porta de entrada, não o limite para sempre.</p>
          </TipCard>

          <TipCard icon={<Layers />} title="Empilhe no que já existe">
            <p>Prenda o micro-hábito a algo que você já faz. A fórmula é simples:</p>
            <p className="mt-2 rounded-lg bg-accent/40 p-3 font-serif text-lg text-foreground">
              Depois de <em>[bloco]</em>, vou <em>[micro-hábito]</em>.
            </p>
            <p className="mt-2">Ao terminar o bloco, o alerta de fim lembra do que vem em seguida.</p>
          </TipCard>

          <TipCard icon={<CalendarRange />} title="66 dias, em média">
            <p>
              Foi o tempo médio para um hábito ficar automático num estudo da University College London (Lally et
              al., 2009). Variou de <strong className="text-foreground">18</strong> a{" "}
              <strong className="text-foreground">254 dias</strong>.
            </p>
            <p className="mt-2">
              Esqueça os 21 dias. E perder um dia não compromete o processo: o importante é retomar.
            </p>
          </TipCard>

          <TipCard icon={<Repeat />} title="Constância vence intensidade">
            <p>
              Ler 30 páginas num dia e passar a semana sem ler pouco ajuda a criar o hábito. Ler uma página todos os
              dias cria uma chance diária de reforçar o comportamento.
            </p>
            <p className="mt-2">Faça da repetição a meta, não da quantidade.</p>
          </TipCard>

          <TipCard icon={<Fingerprint />} title="Identidade, não metas">
            <p>Troque “quero ler mais livros” por “sou uma pessoa que lê diariamente”.</p>
            <p className="mt-2">
              Cada pequena ação é uma evidência dessa identidade. Ler uma página já mostra que você está se tornando
              essa pessoa.
            </p>
          </TipCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Do 1º ao 66º dia</CardTitle>
            <p className="text-sm text-muted-foreground">
              Uma forma prática de atravessar a formação de um hábito. Não aumente a dificuldade só porque passou um
              número de dias.
            </p>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PHASES.map((p) => (
                <li key={p.from} className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground tabular-nums">
                    {p.to === Infinity ? `Após ${p.from - 1} dias` : `Dias ${p.from}–${p.to}`}
                  </p>
                  <p className="mt-1 font-medium">{p.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <figure className="flex flex-col items-center gap-2 rounded-2xl bg-accent/25 px-6 py-8 text-center">
          <Quote className="size-6 text-muted-foreground" aria-hidden />
          <blockquote className="text-balance font-serif text-2xl md:text-3xl">
            Você não precisa ser extraordinário hoje. Precisa apenas ser um pouco melhor do que ontem.
          </blockquote>
          <figcaption className="text-sm text-muted-foreground">Inspirado em Hábitos Atômicos, de James Clear</figcaption>
        </figure>
      </section>

      <HabitDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function HabitCard({
  habit,
  blocks,
  today,
  onEdit,
}: {
  habit: MicroHabitDTO;
  blocks: BlockDTO[];
  today: string;
  onEdit: () => void;
}) {
  const day = habit.createdOn <= today ? dateRange(habit.createdOn, today).length : 1;
  const phase = phaseOf(day);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-balance font-serif text-2xl leading-tight">{habit.title}</p>
            {habit.identity && (
              <p className="mt-1 text-sm text-muted-foreground">
                <Fingerprint className="mr-1 inline size-3.5" aria-hidden />
                Sou uma pessoa que {habit.identity}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={onEdit} aria-label={`Editar ${habit.title}`}>
            <Pencil aria-hidden /> Editar
          </Button>
        </div>

        {blocks.length ? (
          <ul className="flex flex-col gap-1.5">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                <span>
                  Depois de <strong className="font-medium">{b.title}</strong>{" "}
                  <span className="tabular-nums text-muted-foreground">
                    (até {b.endTime}, {whenLabel(b)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Ainda não está empilhado. Na{" "}
            <Link to="/agenda" className="underline underline-offset-2">
              Agenda
            </Link>
            , abra um bloco e escolha este micro-hábito para fazê-lo logo depois.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{phase.title}</span> · {phase.text}
            </span>
            <span className="shrink-0 tabular-nums">
              {day > HABIT_DAYS ? `${day} dias` : `dia ${day} de ${HABIT_DAYS}`}
            </span>
          </div>
          <Progress value={day / HABIT_DAYS} label={`Dia ${day} de ${HABIT_DAYS}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function TipCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/40 [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

/** Criar, editar e excluir um micro-hábito. */
function HabitDialog({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [identity, setIdentity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = !!draft?.id;

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setIdentity(draft.identity);
    setErrors({});
    setConfirmDelete(false);
  }, [draft]);

  const done = (message: string) => {
    void qc.invalidateQueries({ queryKey: ["micro-habits"] });
    // Excluir tira o micro-hábito dos blocos.
    void qc.invalidateQueries({ queryKey: ["blocks"] });
    void qc.invalidateQueries({ queryKey: ["compass"] });
    toast.success(message);
    onClose();
  };

  const save = useMutation({
    mutationFn: (payload: { title: string; identity: string | null }) =>
      editing ? api.patch(`/micro-habits/${draft!.id}`, payload) : api.post("/micro-habits", payload),
    onSuccess: () => done(editing ? "Micro-hábito atualizado." : "Micro-hábito criado. Agora empilhe-o num bloco."),
    onError: (e: Error) => setErrors({ form: e instanceof ApiError ? e.message : "Não foi possível salvar." }),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/micro-habits/${draft!.id}`),
    onSuccess: () => done("Micro-hábito excluído."),
    onError: (e: Error) => setErrors({ form: e.message }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Quem digitar a frase inteira não fica com "Sou uma pessoa que sou uma pessoa que…".
    const cleanIdentity = identity.trim().replace(/^sou uma pessoa que\s*/i, "");
    const payload = { title: title.trim(), identity: cleanIdentity || null };
    const parsed = microHabitSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(payload);
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar micro-hábito" : "Novo micro-hábito"}</DialogTitle>
          <DialogDescription>
            Uma ação pequena, que leve menos de 2 minutos. Depois de salvar, escolha na Agenda o bloco depois do qual
            você vai fazê-la.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Micro-hábito" htmlFor="habit-title" error={errors.title}>
            <Input
              id="habit-title"
              autoFocus
              maxLength={120}
              placeholder="Ex.: ler uma página"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field
            label="Sou uma pessoa que… (opcional)"
            htmlFor="habit-identity"
            error={errors.identity}
            hint="A identidade que cada repetição reforça."
          >
            <Input
              id="habit-identity"
              maxLength={120}
              placeholder="lê todos os dias"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
          </Field>

          {errors.form && (
            <p role="alert" className="rounded-lg bg-destructive/25 p-3 text-sm">
              {errors.form}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {editing ? (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Excluir? Os blocos continuam, sem ele.</span>
                  <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    Sim, excluir
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Não
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Excluir
                </Button>
              )
            ) : (
              <span />
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
