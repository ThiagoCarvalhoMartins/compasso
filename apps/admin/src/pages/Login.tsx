import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginSchema, type AuthResponse } from "@compasso/shared";
import { Button, Card, CardContent, Field, Input } from "@compasso/ui";
import { api, useAdmin } from "../lib";

// RF06.1 — login exclusivo para administradores e suporte
export function LoginPage() {
  const { status, setSession } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError(null);
    try {
      setSession(await api.post<AuthResponse>("/admin/auth/login", parsed.data));
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-5 pt-6">
          <div>
            <h1 className="text-3xl">Painel do Compasso</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito à equipe.</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="E-mail" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/25 p-3 text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
