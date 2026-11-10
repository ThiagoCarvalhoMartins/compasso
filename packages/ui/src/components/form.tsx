import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";

// Em telas de toque o texto fica em 16px: abaixo disso, o Safari do iPhone dá zoom na página ao focar o campo.
const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm pointer-coarse:text-base text-foreground placeholder:text-subtle-foreground transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-[invalid=true]:border-destructive";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />,
);
Input.displayName = "Input";

/** Input de senha com botão de olho para exibir/ocultar o valor digitado. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;
    return (
      <div className="relative">
        {/* ::-ms-reveal: oculta o olho nativo do Edge para não duplicar o botão. */}
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10 [&::-ms-reveal]:hidden", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-label={visible ? "Ocultar senha" : "Exibir senha"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, "min-h-20 py-2", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

/** Campo com rótulo, dica e mensagem de erro ligados por aria (RNF10). */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {React.cloneElement(children, { "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
