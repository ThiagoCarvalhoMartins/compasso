import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const ISO = "yyyy-MM-dd";

/** Converte "yyyy-MM-dd" em Date local (sem deslocar o dia pelo fuso). */
function toDate(value?: string) {
  if (!value) return undefined;
  const d = parse(value, ISO, new Date());
  return isValid(d) ? d : undefined;
}

export interface DatePickerProps {
  id?: string;
  name?: string;
  /** Data no formato "yyyy-MM-dd", como o `<input type="date">`; "" quando vazia. */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  /** Limites no formato "yyyy-MM-dd". */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Mostra o botão "Limpar" para esvaziar o campo. */
  clearable?: boolean;
  /** "dropdown" mostra seletores de mês e ano; útil para datas distantes, como nascimento. */
  captionLayout?: "label" | "dropdown";
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      id,
      name,
      value,
      onChange,
      onBlur,
      min,
      max,
      placeholder = "Selecione uma data",
      disabled,
      clearable,
      captionLayout = "label",
      className,
      ...aria
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = toDate(value);
    const minDate = toDate(min);
    const maxDate = toDate(max);
    const outOfRange = [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(
      (m): m is { before: Date } | { after: Date } => !!m,
    );

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (!next) onBlur?.();
    };
    const commit = (next: string) => {
      onChange?.(next);
      handleOpenChange(false);
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            name={name}
            type="button"
            disabled={disabled}
            data-empty={!selected}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-foreground transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive data-[empty=true]:text-subtle-foreground",
              className,
            )}
            {...aria}
          >
            <CalendarIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            required
            selected={selected}
            onSelect={(d) => commit(format(d, ISO))}
            defaultMonth={selected ?? maxDate ?? minDate}
            disabled={outOfRange}
            startMonth={minDate}
            endMonth={maxDate}
            captionLayout={captionLayout}
            autoFocus
          />
          {clearable && selected && (
            <div className="flex justify-end border-t p-2">
              <Button variant="ghost" size="sm" onClick={() => commit("")}>
                Limpar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = "DatePicker";
