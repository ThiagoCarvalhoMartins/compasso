import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";
import { cn } from "../lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium", className)}
      {...props}
    />
  );
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return src ? (
    <img src={src} alt="" className={cn("size-9 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-hidden
      className={cn("inline-flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-medium", className)}
    >
      {initials}
    </span>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} className={cn("[&_tr]:border-b", p.className)} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} className={cn("[&_tr:last-child]:border-0", p.className)} />;
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...p} className={cn("border-b transition-colors hover:bg-muted/50", p.className)} />;
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...p} className={cn("h-10 px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground", p.className)} />
);
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...p} className={cn("px-3 py-2.5 align-middle", p.className)} />;

/** Toast (Sonner) com o visual do tema. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          fontFamily: "var(--font-sans)",
        },
      }}
    />
  );
}

export { toast } from "sonner";
