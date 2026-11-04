import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ALERT_SOUNDS, birthDateSchema, nameSchema, type SettingsDTO, type UserDTO } from "@compasso/shared";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  downloadBlob,
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { playAlert, unlockAudio } from "../lib/audio";
import { useAuth } from "../lib/auth";
import { browserTimezone } from "../lib/time";

const profileForm = z.object({
  name: nameSchema,
  birthDate: birthDateSchema,
  avatarUrl: z.union([z.literal(""), z.string().url("Informe um link válido.")]),
  timezone: z.string().min(1),
});
type ProfileForm = z.infer<typeof profileForm>;

const SOUND_LABEL = { sino: "Sino", tigela: "Tigela tibetana", suave: "Tom suave" } as const;
const timezones = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [browserTimezone()];
  }
})();

export function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl md:text-4xl">Perfil e preferências</h1>
      <ProfileCard user={user} onSaved={setUser} />
      <AlertsCard />
      <PrivacyCard onDeleted={logout} />
      <Button variant="outline" className="self-start" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}

// RF02.1 / RF02.2
function ProfileCard({ user, onSaved }: { user: UserDTO; onSaved: (u: UserDTO) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileForm),
    defaultValues: {
      name: user.name,
      birthDate: user.birthDate ?? "",
      avatarUrl: user.avatarUrl ?? "",
      timezone: user.timezone,
    },
  });
  const save = useMutation({
    mutationFn: (v: ProfileForm) => api.patch<UserDTO>("/me", { ...v, avatarUrl: v.avatarUrl || null }),
    onSuccess: (u) => {
      onSaved(u);
      qc.invalidateQueries({ queryKey: ["compass"] });
      toast.success("Perfil atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const e = formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seus dados</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nome" htmlFor="name" error={e.name?.message}>
            <Input id="name" {...register("name")} />
          </Field>
          <Field label="Data de nascimento" htmlFor="birthDate" error={e.birthDate?.message}>
            <Input id="birthDate" type="date" {...register("birthDate")} />
          </Field>
          <Field label="Foto (link da imagem)" htmlFor="avatarUrl" error={e.avatarUrl?.message} className="sm:col-span-2">
            <Input id="avatarUrl" type="url" placeholder="https://…" {...register("avatarUrl")} />
          </Field>
          <Field label="Fuso horário" htmlFor="timezone" hint={`Detectado no navegador: ${browserTimezone()}`} className="sm:col-span-2">
            <Select id="timezone" {...register("timezone")}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-sm text-muted-foreground sm:col-span-2">E-mail: {user.email}</p>
          <Button type="submit" className="justify-self-start" disabled={save.isPending}>
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// RF02.3
function AlertsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsDTO>("/me/settings") });
  const [s, setS] = useState<SettingsDTO | null>(null);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (v: SettingsDTO) => api.put<SettingsDTO>("/me/settings", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["compass"] });
      toast.success("Preferências salvas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!s) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.alertsEnabled} onChange={(e) => setS({ ...s, alertsEnabled: e.target.checked })} />
          Tocar alertas no início dos blocos e antes do fim
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Som" htmlFor="sound">
            <Select id="sound" value={s.alertSound} onChange={(e) => setS({ ...s, alertSound: e.target.value as SettingsDTO["alertSound"] })}>
              {ALERT_SOUNDS.map((v) => (
                <option key={v} value={v}>
                  {SOUND_LABEL[v]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="volume">Volume: {Math.round(s.alertVolume * 100)}%</Label>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.alertVolume}
              onChange={(e) => setS({ ...s, alertVolume: Number(e.target.value) })}
              className="h-10 accent-primary-strong"
            />
          </div>
          <Field label="Aviso antes do fim" htmlFor="endAlert">
            <Select id="endAlert" value={s.endAlertMinutes} onChange={(e) => setS({ ...s, endAlertMinutes: Number(e.target.value) })}>
              {[1, 2, 3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              unlockAudio();
              playAlert("start", s.alertSound, s.alertVolume);
            }}
          >
            Testar som
          </Button>
          <Button onClick={() => save.mutate(s)} disabled={save.isPending}>
            Salvar alertas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// RF02.4 / RNF07
function PrivacyCard({ onDeleted }: { onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const exportData = useMutation({
    mutationFn: () => api.get<Blob>("/me/export"),
    onSuccess: (data) => {
      const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, "compasso-meus-dados.json");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.del("/me"),
    onSuccess: () => {
      toast("Sua conta foi excluída.");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacidade (LGPD)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
          Baixar meus dados
        </Button>
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          Excluir minha conta
        </Button>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir conta?</DialogTitle>
              <DialogDescription>
                Seus dados pessoais e blocos serão apagados. Métricas agregadas ficam apenas de forma anônima. Esta ação não pode
                ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Excluir definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
