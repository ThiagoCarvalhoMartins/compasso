import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthResponse } from "@compasso/shared";
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
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { browserTimezone } from "../lib/time";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** RF01.4 — botão do Google; no primeiro acesso pede a data de nascimento (o Google não fornece). */
export function GoogleLogin() {
  const ref = useRef<HTMLDivElement>(null);
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<{ credential: string; name?: string } | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (credential: string, extra: Record<string, unknown> = {}) => {
    try {
      const session = await api.post<AuthResponse>("/auth/google", { credential, timezone: browserTimezone(), ...extra });
      setSession(session);
      setPending(null);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.code === "NEEDS_BIRTH_DATE") {
        setPending({ credential, name: (e.details as { name?: string } | undefined)?.name });
      } else if (pending) {
        setError((e as Error).message);
      } else {
        toast.error((e as Error).message);
      }
    }
  };

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    loadGis()
      .then(() => {
        window.google!.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => submit(r.credential) });
        window.google!.accounts.id.renderButton(ref.current!, { theme: "outline", size: "large", text: "continue_with", shape: "pill", locale: "pt-BR", width: 320 });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div ref={ref} className="flex justify-center" />
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar cadastro</DialogTitle>
            <DialogDescription>
              {pending?.name ? `Olá, ${pending.name}! ` : ""}Para criar sua conta, precisamos da sua data de nascimento.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label="Data de nascimento" htmlFor="g-birth" error={error}>
              <Input id="g-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                Li e aceito a{" "}
                <a href="/privacidade" target="_blank" className="underline">
                  política de privacidade
                </a>
                .
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={!birthDate || !accept}
              onClick={() => {
                setError(undefined);
                void submit(pending!.credential, { birthDate, acceptPrivacy: true });
              }}
            >
              Criar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
