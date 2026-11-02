import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { BLOCK_COLORS, blockInputSchema, WEEKDAYS, type BlockDTO, type CategoryDTO } from "@compasso/shared";
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
  Select,
  Textarea,
  cn,
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { WEEKDAY_LABELS } from "../lib/time";

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
}

export type BlockDraft = Partial<BlockDTO> & { date?: string | null };

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
});

/** RF03.1–RF03.3, RF03.6 — criar, editar, duplicar e excluir blocos. */
export function BlockFormDialog({
  open,
  onOpenChange,
  draft,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const { register, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: toForm(draft, defaultDate),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset(toForm(draft, defaultDate));
      setErrors({});
      setFormError(null);
    }
  }, [open, draft, defaultDate, reset]);

  const recurrence = watch("recurrence");
  const repeatMode = watch("repeatMode");
  const weekdays = watch("repeatWeekdays");
  const color = watch("color");

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["compass"] });
    toast.success(message);
    onOpenChange(false);
  };

  const save = useMutation({
    mutationFn: (payload: unknown) =>
      editing ? api.patch<BlockDTO>(`/blocks/${draft.id}`, payload) : api.post<BlockDTO>("/blocks", payload),
    onSuccess: () => done(editing ? "Bloco atualizado." : "Bloco criado."),
    onError: (e: Error) => setFormError(e instanceof ApiError ? e.message : "Não foi possível salvar."),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/blocks/${draft.id}`),
    onSuccess: () => done("Bloco excluído."),
    onError: (e: Error) => setFormError(e.message),
  });

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
    save.mutate(parsed.data);
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
            <DialogDescription>Este bloco se repete: as mudanças valem para todos os dias em que ele aparece.</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Título" htmlFor="title" error={errors.title}>
            <Input id="title" autoFocus {...register("title")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
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
                  <p role="alert" className="text-xs text-[#9b4a37]">
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
            <Input id="date" type="date" {...register("date")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria" htmlFor="categoryId">
              <Select id="categoryId" value={watch("categoryId")} onChange={(e) => onCategory(e.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
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
                    className={cn("size-8 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Field label="Descrição (opcional)" htmlFor="description">
            <Textarea id="description" rows={2} {...register("description")} />
          </Field>

          <label className="flex items-start gap-2 rounded-lg bg-accent/40 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" {...register("isOneThing")} />
            <span>
              <strong className="font-medium">A Única Coisa</strong> — o bloco mais importante do dia. Só um por dia.
            </span>
          </label>

          {formError && (
            <p role="alert" className="rounded-lg bg-destructive/25 p-3 text-sm">
              {formError}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
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
      </DialogContent>
    </Dialog>
  );
}
