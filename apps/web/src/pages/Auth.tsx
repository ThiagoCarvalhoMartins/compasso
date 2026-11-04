import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
} from "@compasso/shared";
import { ApiError, Button, Card, CardContent, Field, Input, PasswordInput } from "@compasso/ui";
import { GoogleLogin } from "../components/GoogleLogin";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { browserTimezone } from "../lib/time";

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <img src="/icon.svg" alt="" className="size-10" />
        <span className="font-serif text-2xl">
          Compasso <span className="text-muted-foreground">· Agenda em Ritmo</span>
        </span>
      </Link>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-5 pt-6">
          <div>
            <h1 className="text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-destructive/25 p-3 text-sm">{error}</p>;
  if (success) return <p role="status" className="rounded-lg bg-primary/30 p-3 text-sm">{success}</p>;
  return null;
}

// RF01.3
export function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setUnverified(null);
    try {
      setSession(await api.post<AuthResponse>("/auth/login", v));
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") setUnverified(v.email);
    }
  });

  return (
    <AuthShell title="Entrar" subtitle="Bem-vindo de volta ao seu ritmo.">
      <GoogleLogin />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Senha" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...register("password")} />
        </Field>
        <FormMessage error={error} />
        {unverified && (
          <Button type="button" variant="link" className="self-start p-0" onClick={() => api.post("/auth/resend-verification", { email: unverified }).then(() => setError("Enviamos um novo link de confirmação."))}>
            Reenviar e-mail de confirmação
          </Button>
        )}
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link to="/esqueci-senha" className="underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
        <Link to="/cadastro" className="font-medium underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </div>
    </AuthShell>
  );
}

// RF01.1 / RNF07
export function RegisterPage() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await api.post<{ message: string }>("/auth/register", { ...v, timezone: browserTimezone() });
      setDone(r.message);
    } catch (err) {
      setError((err as Error).message);
    }
  });

  if (done)
    return (
      <AuthShell title="Confira seu e-mail">
        <FormMessage success={done} />
        <Link to="/entrar" className="text-sm underline">
          Voltar para o login
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell title="Criar conta" subtitle="Transforme sua agenda em um ritmo que dá para seguir.">
      <GoogleLogin />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" htmlFor="name" error={e.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Senha" htmlFor="password" error={e.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Data de nascimento" htmlFor="birthDate" error={e.birthDate?.message} hint="É preciso ter pelo menos 13 anos.">
          <Input id="birthDate" type="date" {...register("birthDate")} />
        </Field>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" {...register("acceptPrivacy")} />
            <span>
              Li e aceito a{" "}
              <Link to="/privacidade" target="_blank" className="underline">
                política de privacidade
              </Link>
              .
            </span>
          </label>
          {e.acceptPrivacy && (
            <p role="alert" className="text-xs text-[#9b4a37]">
              {e.acceptPrivacy.message}
            </p>
          )}
        </div>
        <FormMessage error={error} />
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          Criar conta
        </Button>
      </form>
      <p className="text-sm">
        Já tem conta?{" "}
        <Link to="/entrar" className="font-medium underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}

// RF01.2
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api
      .post<{ message: string }>("/auth/verify-email", { token: params.get("token") ?? "" })
      .then((r) => setState({ success: r.message }))
      .catch((e: Error) => setState({ error: e.message }));
  }, [params]);
  return (
    <AuthShell title="Confirmação de e-mail">
      {!state.error && !state.success && <p className="text-sm text-muted-foreground">Confirmando…</p>}
      <FormMessage {...state} />
      <Button asChild>
        <Link to="/entrar">Ir para o login</Link>
      </Button>
    </AuthShell>
  );
}

// RF01.6
export function ForgotPasswordPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });
  return (
    <AuthShell title="Esqueci minha senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      <form
        onSubmit={handleSubmit(async (v) => setMsg((await api.post<{ message: string }>("/auth/forgot-password", v)).message))}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <FormMessage success={msg} />
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          Enviar link
        </Button>
      </form>
      <Link to="/entrar" className="text-sm underline">
        Voltar para o login
      </Link>
    </AuthShell>
  );
}

const resetForm = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetForm>>({ resolver: zodResolver(resetForm) });
  return (
    <AuthShell title="Nova senha">
      <form
        onSubmit={handleSubmit(async (v) => {
          try {
            const r = await api.post<{ message: string }>("/auth/reset-password", { token: params.get("token") ?? "", password: v.password });
            setState({ success: r.message });
          } catch (e) {
            setState({ error: (e as Error).message });
          }
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field label="Nova senha" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Confirme a senha" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <FormMessage {...state} />
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          Salvar nova senha
        </Button>
      </form>
      <Link to="/entrar" className="text-sm underline">
        Ir para o login
      </Link>
    </AuthShell>
  );
}

// RNF07
export function PrivacyPage() {
  return (
    <AuthShell title="Política de privacidade">
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          O Compasso coleta apenas o necessário para funcionar: nome, e-mail, data de nascimento (para a idade mínima de 13
          anos), fuso horário, seus blocos de agenda e o registro das Repetições QP.
        </p>
        <p>
          Usamos esses dados para mostrar sua agenda, tocar os alertas e gerar estatísticas agregadas e anônimas. Não vendemos
          nem compartilhamos seus dados com terceiros, exceto os provedores que operam o serviço (hospedagem na Microsoft
          Azure, envio de e-mails e login com Google, se você escolher).
        </p>
        <p>
          Você pode baixar todos os seus dados ou excluir sua conta a qualquer momento em <strong>Perfil</strong>. Na exclusão,
          os dados pessoais são apagados em até 30 dias e só métricas anônimas são mantidas.
        </p>
        <p>
          Menores de 18 anos devem usar o Compasso com o consentimento de um responsável, conforme a LGPD.
        </p>
      </div>
      <Link to="/" className="text-sm underline">
        Voltar
      </Link>
    </AuthShell>
  );
}
