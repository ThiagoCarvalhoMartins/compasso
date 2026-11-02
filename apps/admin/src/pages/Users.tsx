import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { UserDTO } from "@compasso/shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from "@compasso/ui";
import { ROLE_LABEL, STATUS_LABEL, api, formatDateTime, useAdmin } from "../lib";

type AdminUser = UserDTO & { createdAt: string; lastLoginAt: string | null };
interface Page<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

const statusClass = { ACTIVE: "bg-primary/50", BLOCKED: "bg-destructive/50", DELETED: "bg-muted" } as const;

/** RF07.1 — busca por nome/e-mail e filtros por status, data de cadastro e tipo de login. */
export function UsersPage() {
  const [filters, setFilters] = useState({ q: "", status: "", loginType: "", createdFrom: "", createdTo: "" });
  const [page, setPage] = useState(1);
  const params = new URLSearchParams(
    Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== "") as [string, string][],
  );
  const { data, isFetching } = useQuery({
    queryKey: ["admin-users", params.toString()],
    queryFn: () => api.get<Page<AdminUser>>(`/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl">Usuários</h1>
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <Label htmlFor="q">Buscar</Label>
            <Input id="q" placeholder="Nome ou e-mail" value={filters.q} onChange={set("q")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={filters.status} onChange={set("status")}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loginType">Login</Label>
            <Select id="loginType" value={filters.loginType} onChange={set("loginType")}>
              <option value="">Todos</option>
              <option value="email">E-mail</option>
              <option value="google">Google</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">Cadastro de</Label>
              <Input id="from" type="date" value={filters.createdFrom} onChange={set("createdFrom")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">até</Label>
              <Input id="to" type="date" value={filters.createdTo} onChange={set("createdTo")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>E-mail</TH>
              <TH>Status</TH>
              <TH>Login</TH>
              <TH>Cadastro</TH>
              <TH>Último acesso</TH>
            </TR>
          </THead>
          <TBody>
            {data?.items.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link to={`/usuarios/${u.id}`} className="font-medium underline-offset-4 hover:underline">
                    {u.name}
                  </Link>
                  {u.role !== "USER" && <Badge className="ml-2">{ROLE_LABEL[u.role]}</Badge>}
                </TD>
                <TD>{u.email}</TD>
                <TD>
                  <Badge className={statusClass[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                </TD>
                <TD>{u.hasGoogle ? (u.hasPassword ? "E-mail + Google" : "Google") : "E-mail"}</TD>
                <TD>{formatDateTime(u.createdAt)}</TD>
                <TD>{formatDateTime(u.lastLoginAt)}</TD>
              </TR>
            ))}
            {data && !data.items.length && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{data?.total ?? 0} usuário(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

/** RF07.2–RF07.4 — detalhes e ações. Suporte só desbloqueia (RF06.2). */
export function UserDetailPage() {
  const { id } = useParams();
  const { admin } = useAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = admin?.role === "ADMIN";
  const { data: u } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => api.get<AdminUser & { blocksCount: number; qpSessionsCount: number }>(`/admin/users/${id}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-user", id] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "BLOCKED") => api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      refresh();
      toast.success("Status atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resend = useMutation({
    mutationFn: (type: "verify" | "reset") => api.post(`/admin/users/${id}/resend`, { type }),
    onSuccess: () => toast.success("E-mail enviado."),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/admin/users/${id}`),
    onSuccess: () => {
      refresh();
      toast.success("Conta excluída.");
      navigate("/usuarios");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!u) return <p className="text-muted-foreground">Carregando…</p>;
  const deleted = u.status === "DELETED";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link to="/usuarios" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Usuários
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{u.name}</h1>
        <Badge className={statusClass[u.status]}>{STATUS_LABEL[u.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["E-mail", u.email],
              ["E-mail confirmado", u.emailVerified ? "Sim" : "Não"],
              ["Papel", ROLE_LABEL[u.role]],
              ["Login", u.hasGoogle ? (u.hasPassword ? "E-mail + Google" : "Google") : "E-mail"],
              ["Data de nascimento", u.birthDate ?? "—"],
              ["Fuso horário", u.timezone],
              ["Cadastro", formatDateTime(u.createdAt)],
              ["Último acesso", formatDateTime(u.lastLoginAt)],
              ["Blocos", u.blocksCount],
              ["Sessões QP", u.qpSessionsCount],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {!deleted && (
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {u.status === "BLOCKED" ? (
              <Button onClick={() => setStatus.mutate("ACTIVE")}>Desbloquear</Button>
            ) : (
              isAdmin && (
                <Button variant="outline" onClick={() => setStatus.mutate("BLOCKED")}>
                  Bloquear
                </Button>
              )
            )}
            {isAdmin && (
              <>
                {!u.emailVerified && (
                  <Button variant="outline" onClick={() => resend.mutate("verify")}>
                    Reenviar confirmação
                  </Button>
                )}
                <Button variant="outline" onClick={() => resend.mutate("reset")}>
                  Enviar redefinição de senha
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => window.confirm(`Excluir a conta de ${u.name}? Esta ação não pode ser desfeita.`) && remove.mutate()}
                >
                  Excluir conta
                </Button>
              </>
            )}
            {!isAdmin && <p className="text-sm text-muted-foreground">Perfil Suporte: somente leitura e desbloqueio.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
