import * as React from "react";
import { DayPicker, type ChevronProps, type DropdownProps } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown;
  return <Icon aria-hidden className={cn("size-4", className)} />;
}

/** Seletor de mês/ano com o Select do projeto, no lugar do `<select>` nativo do DayPicker. */
function CalendarDropdown({ options, value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  return (
    <Select
      value={value === undefined ? undefined : String(value)}
      disabled={disabled}
      onValueChange={(v) => onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-8 w-fit gap-1 px-2 font-medium capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options?.map((o) => (
          <SelectItem key={o.value} value={String(o.value)} disabled={o.disabled} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, components, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex w-full flex-col gap-4",
        // A barra das setas fica por cima da legenda; só os botões recebem o ponteiro,
        // senão ela bloqueia os seletores de mês e ano.
        nav: "pointer-events-none absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "pointer-events-auto size-8 aria-disabled:opacity-50"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "pointer-events-auto size-8 aria-disabled:opacity-50"),
        month_caption: "flex h-8 items-center justify-center px-9",
        caption_label: "text-sm font-medium capitalize",
        dropdowns: "flex items-center justify-center gap-1",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-xs font-normal capitalize text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center text-sm",
        day_button:
          "size-9 cursor-pointer rounded-md transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/85",
        today: "[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4",
        outside: "text-subtle-foreground",
        disabled: "opacity-50 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron, Dropdown: CalendarDropdown, ...components }}
      {...props}
    />
  );
}
