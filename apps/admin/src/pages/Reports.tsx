import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { addDays } from "@compasso/shared";
import { Button, Card, CardContent, Input, Label, Select, Table, TBody, TD, TH, THead, TR, downloadBlob, toast } from "@compasso/ui";
import { AGE_GROUPS, api } from "../lib";

type ReportType = "cadastros" | "engajamento";
type Row = Record<string, string | number>;

/** RF09 — relatórios agregados com filtros e exportação em CSV e PDF. */
export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<ReportType>("engajamento");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [ageGroup, setAgeGroup] = useState("");

  const qs = (format: string) =>
    new URLSearchParams({ from, to, format, ...(ageGroup ? { ageGroup } : {}) }).toString();

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["report", type, from, to, ageGroup],
    queryFn: () => api.get<Row[]>(`/admin/reports/${type}?${qs("json")}`),
    enabled: from <= to,
  });

  const exportAs = async (format: "csv" | "pdf") => {
    try {
      const blob = await api.get<Blob>(`/admin/reports/${type}?${qs(format)}`);
      downloadBlob(blob, `compasso-${type}-${from}-a-${to}.${format}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl">Relatórios</h1>
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Relatório</Label>
            <Select id="type" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              <option value="cadastros">Cadastros por período</option>
              <option value="engajamento">Engajamento</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="age">Faixa etária</Label>
            <Select id="age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              <option value="">Todas</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g} anos
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportAs("csv")}>
              <Download aria-hidden /> CSV
            </Button>
            <Button variant="outline" onClick={() => exportAs("pdf")}>
              <Download aria-hidden /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Somente dados agregados — o conteúdo dos blocos dos usuários nunca aparece aqui.</p>

      <Card className={isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <Table>
          <THead>
            <TR>
              {headers.map((h) => (
                <TH key={h}>{h.replace(/_/g, " ")}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={String(r.data)}>
                {headers.map((h) => (
                  <TD key={h} className="tabular-nums">
                    {r[h]}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
