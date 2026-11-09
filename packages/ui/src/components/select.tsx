import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";

type AriaProps = { "aria-invalid"?: boolean; "aria-describedby"?: string };

/** Repassa ao gatilho os atributos aria que o `Field` injeta no filho direto. */
const SelectAriaContext = React.createContext<AriaProps>({});

export function Select({
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & AriaProps) {
  return (
    <SelectAriaContext.Provider value={{ "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy }}>
      <SelectPrimitive.Root {...props} />
    </SelectAriaContext.Provider>
  );
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const aria = React.useContext(SelectAriaContext);
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-foreground transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive data-[placeholder]:text-subtle-foreground [&>span]:truncate",
        className,
      )}
      {...aria}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const scrollButtonClass = "flex cursor-default items-center justify-center py-1 text-muted-foreground";

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      {/* z-[60]: acima do Dialog (z-50), já que há selects dentro de diálogos. */}
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "relative z-[60] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-32 overflow-hidden rounded-lg border bg-card text-foreground shadow-[var(--shadow-soft)]",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className={scrollButtonClass}>
          <ChevronUp aria-hidden className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className={scrollButtonClass}>
          <ChevronDown aria-hidden className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function SelectItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm outline-none transition-colors duration-200 data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
