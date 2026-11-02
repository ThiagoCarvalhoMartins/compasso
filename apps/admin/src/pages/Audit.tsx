import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, Card, Table, TBody, TD, TH, THead, TR } from "@compasso/ui";
import { api, formatDateTime } from "../lib";

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  admin: { name: string; email: string };
  targetUser: { name: string; email: string } | null;
}

const ACTION_LABEL: Record<string, string> = {
  "user.block": "Bloqueou usuário",
  "user.unblock": "Desbloqueou usuário",
  "user.delete": "Excluiu usuário",
  "user.resend.verify": "Reenviou confirmação de e-mail",
  "user.resend.reset": "Enviou redefinição de senha",
  "report.view": "Gerou relatório",
};

/** RF07.5 — log de auditoria das ações administrativas. */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api.get<{ total: number; pageSize: number; items: AuditLog[] }>(`/admin/audit-logs?page=${page}`),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl">Auditoria</h1>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Quando</TH>
              <TH>Quem</TH>
              <TH>Ação</TH>
              <TH>Alvo</TH>
              <TH>Detalhes</TH>
            </TR>
          </THead>
          <TBody>
            {data?.items.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap">{formatDateTime(l.createdAt)}</TD>
                <TD>{l.admin.name}</TD>
                <TD>{ACTION_LABEL[l.action] ?? l.action}</TD>
                <TD>{l.targetUser?.email ?? "—"}</TD>
                <TD className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                  {l.metadata ? JSON.stringify(l.metadata) : ""}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <div className="flex items-center justify-end gap-2 text-sm">
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
  );
}
