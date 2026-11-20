import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import {
  BLOCK_COLORS,
  blockInputSchema,
  minutesToTime,
  peakHours,
  reliableEnergyHours,
  timeToMinutes,
  WEEKDAYS,
  type BlockScope,
  type BlockDTO,
  type CategoryDTO,
} from "@compasso/shared";
import {
  ApiError,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { useEnergyHours } from "../hooks/useEnergyHours";
import { WEEKDAY_LABELS, formatShortDate, todayInBrowser } from "../lib/time";

/** O Select do Radix não aceita item com valor vazio; este valor representa a opção "Sem categoria". */
const NO_CATEGORY = "__none__";

interface FormValues {
  title: string;
  description: string;
  categoryId: string;
  color: string;
  date: string;
  startTime: string;
  endTime: string;
  recurrence: "ONCE" | "REPEAT";
  repeatMode: "all" | "some";
  repeatWeekdays: number[];
  isOneThing: boolean;
  minimumVersion: string;
}

export type BlockDraft = Partial<BlockDTO> & {
  date?: string | null;
  /** Dia em que o bloco recorrente foi aberto na agenda: referência para excluir ou editar só parte da série. */
  occurrenceDate?: string;
};

const toForm = (draft: BlockDraft, defaultDate: string): FormValues => ({
  title: draft.title ?? "",
  description: draft.description ?? "",
  categoryId: draft.categoryId ?? "",
  color: draft.color ?? BLOCK_COLORS[0],
  date: (draft.recurrence === "REPEAT" ? draft.startsOn : draft.date) ?? defaultDate,
  startTime: draft.startTime ?? "09:00",
  endTime: draft.endTime ?? "10:00",
  recurrence: draft.recurrence ?? "ONCE",
  repeatMode: draft.repeatWeekdays && draft.repeatWeekdays.length < 7 ? "some" : "all",
  repeatWeekdays: draft.repeatWeekdays?.length ? draft.repeatWeekdays : [1, 2, 3, 4, 5],
  isOneThing: draft.isOneThing ?? false,
  minimumVersion: draft.minimumVersion ?? "",
});

/** RF03.1–RF03.3, RF03.6 — criar, editar, duplicar e excluir blocos. */
export function BlockFormDialog({
  open,
  onOpenChange,
  draft,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com o bloco gravado (ex.: a pergunta focal liga o bloco novo à Única Coisa do dia). */
  onSaved?: (block: BlockDTO) => void;
  /** Com id = edição; sem id = novo bloco (ou duplicado). */
  draft: BlockDraft;
  defaultDate: string;
}) {
  const qc = useQueryClient();
  const editing = !!draft.id;
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryDTO[]>("/categories"),
  });
  const { register, control, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: toForm(draft, defaultDate),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [askDeleteScope, setAskDeleteScope] = useState(false);
  /** Edição de horário de um recorrente aguardando o usuário escolher o escopo. */
  const [pendingEdit, setPendingEdit] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      reset(toForm(draft, defaultDate));
      setErrors({});
      setFormError(null);
      setAskDeleteScope(false);
      setPendingEdit(null);
    }
  }, [open, draft, defaultDate, reset]);

  const recurrence = watch("recurrence");
  const repeatMode = watch("repeatMode");
  const weekdays = watch("repeatWeekdays");
  const color = watch("color");
  const isOneThing = watch("isOneThing");
  // A Única Coisa no pico de energia: sugere o horário de maior energia média dos últimos 30 dias.
  const energyHours = useEnergyHours(open ? todayInBrowser() : undefined);
  const peak = peakHours(energyHours, 1)[0];
  const peakAverage = peak !== undefined ? reliableEnergyHours(energyHours).get(peak) : undefined;
  const usePeak = () => {
    if (peak === undefined) return;
    const duration = timeToMinutes(watch("endTime")) - timeToMinutes(watch("startTime"));
    const start = peak * 60;
    setValue("startTime", minutesToTime(start));
    setValue("endTime", minutesToTime(Math.min(start + (duration > 0 ? duration : 90), 23 * 60 + 59)));
  };

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["compass"] });
    toast.success(message);
    onOpenChange(false);
  };

  const save = useMutation({
    mutationFn: ({ payload, scope }: { payload: unknown; scope?: BlockScope }) =>
      editing
        ? api.patch<BlockDTO>(
            scope ? `/blocks/${draft.id}?scope=${scope}&date=${draft.occurrenceDate}` : `/blocks/${draft.id}`,
            payload,
          )
        : api.post<BlockDTO>("/blocks", payload),
    onSuccess: (block, { scope }) => {
      onSaved?.(block);
      done(
        !editing
          ? "Bloco criado."
          : scope === "following"
            ? "Bloco atualizado deste dia em diante."
            : scope === "single"
              ? "Bloco atualizado neste dia."
              : "Bloco atualizado.",
      );
    },
    onError: (e: Error) => {
      setPendingEdit(null);
      setFormError(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    },
  });

  const remove = useMutation({
    mutationFn: (scope?: BlockScope) =>
      api.del(scope ? `/blocks/${draft.id}?scope=${scope}&date=${draft.occurrenceDate}` : `/blocks/${draft.id}`),
    onSuccess: (_, scope) =>
      done(scope === "following" ? "Bloco excluído deste dia em diante." : scope === "single" ? "Bloco excluído neste dia." : "Bloco excluído."),
    onError: (e: Error) => {
      setAskDeleteScope(false);
      setFormError(e.message);
    },
  });

  const onDelete = () => {
    if (draft.recurrence === "REPEAT" && draft.occurrenceDate) setAskDeleteScope(true);
    else remove.mutate(undefined);
  };

  const onSubmit = handleSubmit((v) => {
    const payload = {
      title: v.title,
      description: v.description || null,
      categoryId: v.categoryId || null,
      color: v.color,
      recurrence: v.recurrence,
      date: v.recurrence === "ONCE" ? v.date : null,
      startsOn: v.recurrence === "REPEAT" ? v.date : null,
      repeatWeekdays: v.recurrence === "REPEAT" ? (v.repeatMode === "all" ? [...WEEKDAYS] : v.repeatWeekdays) : [],
      startTime: v.startTime,
      endTime: v.endTime,
      isOneThing: v.isOneThing,
      minimumVersion: v.minimumVersion.trim() || null,
    };
    // Mesmo schema Zod da API: erros aparecem antes de enviar.
    const parsed = blockInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "startsOn" ? "date" : String(issue.path[0]);
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);
    // Mudou o horário de um recorrente (sem mexer na repetição): pergunta se vale só para este dia ou os seguintes.
    const timeChanged = v.startTime !== draft.startTime || v.endTime !== draft.endTime;
    const sameSeries =
      v.recurrence === "REPEAT" &&
      v.date === draft.startsOn &&
      [...payload.repeatWeekdays].sort().join() === [...(draft.repeatWeekdays ?? [])].sort().join();
    if (editing && draft.recurrence === "REPEAT" && draft.occurrenceDate && timeChanged && sameSeries) {
      setPendingEdit(parsed.data);
      return;
    }
    save.mutate({ payload: parsed.data });
  });

  const onCategory = (id: string) => {
    setValue("categoryId", id);
    const category = categories.find((c) => c.id === id);
    if (category) setValue("color", category.color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          {editing && draft.recurrence === "REPEAT" && (
            <DialogDescription>
              Este bloco se repete: as mudanças valem para todos os dias em que ele aparece. Ao mudar o horário, você
              escolhe se vale só para este dia ou também para os seguintes.
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Título" htmlFor="title" error={errors.title}>
            <Input id="title" autoFocus {...register("title")} />
          </Field>

          {/* Em telas estreitas, Fim desce para a linha de baixo para os campos não se sobreporem.
              grid-cols-1 (minmax(0, 1fr)) impede que a largura intrínseca dos campos de hora alargue a coluna. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Início" htmlFor="startTime" error={errors.startTime}>
              <Input id="startTime" type="time" {...register("startTime")} />
            </Field>
            <Field label="Fim" htmlFor="endTime" error={errors.endTime}>
              <Input id="endTime" type="time" {...register("endTime")} />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Recorrência</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="ONCE" {...register("recurrence")} /> Apenas neste dia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="REPEAT" {...register("recurrence")} /> Repetir nos dias seguintes
            </label>
            {recurrence === "REPEAT" && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="all" {...register("repeatMode")} /> Todos os dias
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="some" {...register("repeatMode")} /> Só em alguns dias
                  </label>
                </div>
                {repeatMode === "some" && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = weekdays.includes(d);
                      return (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={on}
                          onClick={() =>
                            setValue("repeatWeekdays", on ? weekdays.filter((x) => x !== d) : [...weekdays, d])
                          }
                          className={cn(
                            "h-9 w-11 rounded-lg border text-sm transition-colors duration-200",
                            on ? "border-primary-strong bg-primary" : "bg-card hover:bg-muted",
                          )}
                        >
                          {WEEKDAY_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.repeatWeekdays && (
                  <p role="alert" className="text-xs text-error">
                    {errors.repeatWeekdays}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <Field
            label={recurrence === "REPEAT" ? "A partir de" : "Data"}
            htmlFor="date"
            error={errors.date}
          >
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePicker
                  id="date"
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria" htmlFor="categoryId">
              <Select
                value={watch("categoryId") || NO_CATEGORY}
                onValueChange={(v) => onCategory(v === NO_CATEGORY ? "" : v)}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor do bloco">
                {BLOCK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    onClick={() => setValue("color", c)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2",
                      color === c ? "border-foreground" : "border-transparent",
                    )}
                    style={{ background: c }}
                  >
                    {color === c && <Check className="size-4 text-neutral-800" strokeWidth={3} aria-hidden />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label="Descrição (opcional)" htmlFor="description">
            <Textarea id="description" rows={2} {...register("description")} />
          </Field>

          <Field
            label="Versão de 2 minutos (opcional)"
            htmlFor="minimumVersion"
            error={errors.minimumVersion}
            hint="O mínimo que já conta como não ter desistido. Nos dias difíceis, o app sugere começar por ela."
          >
            <Input
              id="minimumVersion"
              maxLength={120}
              placeholder="Ex.: ler 1 página, calçar o tênis"
              {...register("minimumVersion")}
            />
          </Field>

          <label className="flex items-start gap-2 rounded-lg bg-accent/40 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" {...register("isOneThing")} />
            <span>
              <strong className="font-medium">A Única Coisa</strong> — o bloco mais importante do dia. Só um por dia.
            </span>
          </label>
          {isOneThing && peak !== undefined && peakAverage !== undefined && (
            <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Seu pico de energia costuma ser às {peak}h (média{" "}
                {peakAverage.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}).
              </span>
              <Button type="button" size="sm" variant="outline" onClick={usePeak}>
                Usar esse horário
              </Button>
            </div>
          )}

          {formError && (
            <p role="alert" className="rounded-lg bg-destructive/25 p-3 text-sm">
              {formError}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onDelete} disabled={remove.isPending}>
                  <Trash2 aria-hidden /> Excluir
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>

        <Dialog open={pendingEdit !== null} onOpenChange={(o) => !o && setPendingEdit(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Alterar horário do bloco recorrente</DialogTitle>
              <DialogDescription>"{draft.title}" se repete. Onde o novo horário deve valer?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => save.mutate({ payload: pendingEdit, scope: "single" })}
              >
                Apenas este ({draft.occurrenceDate && formatShortDate(draft.occurrenceDate)})
              </Button>
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => save.mutate({ payload: pendingEdit, scope: "following" })}
              >
                Este e todos os seguintes
              </Button>
              <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ payload: pendingEdit })}>
                Todos os dias
              </Button>
              <Button variant="ghost" disabled={save.isPending} onClick={() => setPendingEdit(null)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={askDeleteScope} onOpenChange={setAskDeleteScope}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir bloco recorrente</DialogTitle>
              <DialogDescription>"{draft.title}" se repete. O que você quer excluir?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate("single")}>
                Apenas este ({draft.occurrenceDate && formatShortDate(draft.occurrenceDate)})
              </Button>
              <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate("following")}>
                Este e todos os seguintes
              </Button>
              <Button variant="ghost" disabled={remove.isPending} onClick={() => setAskDeleteScope(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
