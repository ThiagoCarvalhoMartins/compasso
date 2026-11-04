import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const itemBase =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors duration-200 data-[highlighted]:bg-muted [&_svg]:size-4";

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-40 min-w-40 rounded-lg border bg-card p-1 shadow-[var(--shadow-soft)]", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(itemBase, className)} {...props} />;
}

/** Item com chave liga/desliga; o menu continua aberto para mostrar o resultado. */
export function DropdownMenuSwitchItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemBase, "group", className)}
      onSelect={(e) => e.preventDefault()}
      {...props}
    >
      {children}
      <span
        aria-hidden
        className="ml-auto flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/40 p-0.5 transition-colors duration-200 group-data-[state=checked]:bg-primary"
      >
        <span className="size-4 rounded-full bg-white transition-transform duration-200 group-data-[state=checked]:translate-x-4" />
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
