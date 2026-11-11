import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@compasso/ui";
import { CHART, api, pct } from "../lib";

interface Dashboard {
  users: { total: number; newDay: number; newWeek: number; newMonth: number };
  active: { dau: number; wau: number; mau: number };
  retention: { d1: number | null; d7: number | null; d30: number | null };
  completion: { planned: number; done: number; rate: number | null };
  qp: {
    perDay: { date: string; count: number }[];
    averagePerActiveUser: number;
    mostChosenSeconds: number | null;
    durations: { seconds: number; count: number }[];
  };
  loginType: { google: number; email: number };
  ageGroups: { group: string; count: number }[];
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = { background: "#FFFDF9", border: `1px solid ${CHART.grid}`, borderRadius: 12, color: CHART.ink, fontSize: 13 };

/** RF08 — indicadores do dashboard. */
export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/admin/dashboard") });
  if (isLoading || !data) return <p className="text-muted-foreground">Carregando indicadores…</p>;

  const loginData = [
    { name: "E-mail", value: data.loginType.email, color: CHART.blue },
    { name: "Google", value: data.loginType.google, color: CHART.peach },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl">Dashboard</h1>

      <section aria-label="Usuários" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Usuários" value={data.users.total} hint={`+${data.users.newDay} hoje · +${data.users.newWeek} na semana · +${data.users.newMonth} no mês`} />
        <Stat label="Ativos (DAU / WAU / MAU)" value={`${data.active.dau} / ${data.active.wau} / ${data.active.mau}`} hint="Abriram a tela Compasso" />
        <Stat label="Retenção D1 · D7 · D30" value={`${pct(data.retention.d1)} · ${pct(data.retention.d7)} · ${pct(data.retention.d30)}`} />
        <Stat label="Taxa de cumprimento" value={pct(data.completion.rate)} hint={`${data.completion.done} de ${data.completion.planned} blocos (30 dias)`} />
      </section>

      <section aria-label="Repetições QP" className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Repetições QP por dia</CardTitle>
            <p className="text-sm text-muted-foreground">
              Média de {data.qp.averagePerActiveUser.toFixed(1)} por usuário ativo · duração mais escolhida:{" "}
              {data.qp.mostChosenSeconds ? `${data.qp.mostChosenSeconds} s` : "—"}
            </p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.qp.perDay}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} tick={{ fontSize: 11, fill: CHART.ink }} />
                <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: CHART.ink }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F1ECE4" }} />
                <Bar dataKey="count" name="Repetições" fill={CHART.secondary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipo de login</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={loginData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
                  {loginData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="#FFFDF9" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Faixa etária</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.ageGroups}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="group" tick={{ fontSize: 12, fill: CHART.ink }} />
              <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: CHART.ink }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F1ECE4" }} />
              <Bar dataKey="count" name="Usuários" fill={CHART.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
