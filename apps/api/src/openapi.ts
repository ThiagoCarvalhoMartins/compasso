/** Documentação OpenAPI das rotas da API (servida em /api/v1/docs). */

type Route = [method: string, path: string, summary: string, tag: string, auth?: "user" | "admin" | "none"];

const routes: Route[] = [
  ["post", "/auth/register", "Cadastro com e-mail e senha", "Autenticação", "none"],
  ["post", "/auth/verify-email", "Confirma o e-mail pelo token", "Autenticação", "none"],
  ["post", "/auth/resend-verification", "Reenvia o e-mail de confirmação", "Autenticação", "none"],
  ["post", "/auth/login", "Login com e-mail e senha", "Autenticação", "none"],
  ["post", "/auth/google", "Login ou cadastro com o token do Google", "Autenticação", "none"],
  ["post", "/auth/refresh", "Renova o access token (cookie httpOnly)", "Autenticação", "none"],
  ["post", "/auth/logout", "Revoga o refresh token", "Autenticação", "none"],
  ["post", "/auth/forgot-password", "Envia link de redefinição", "Autenticação", "none"],
  ["post", "/auth/reset-password", "Define nova senha", "Autenticação", "none"],
  ["get", "/me", "Lê o perfil", "Perfil"],
  ["patch", "/me", "Atualiza o perfil", "Perfil"],
  ["delete", "/me", "Exclui a conta (LGPD)", "Perfil"],
  ["get", "/me/export", "Exporta os dados do usuário (LGPD)", "Perfil"],
  ["get", "/me/settings", "Preferências de alertas e duração QP", "Perfil"],
  ["put", "/me/settings", "Atualiza as preferências", "Perfil"],
  ["get", "/categories", "Lista categorias (padrão + do usuário)", "Agenda"],
  ["post", "/categories", "Cria categoria", "Agenda"],
  ["get", "/blocks", "Lista blocos (todos, ou o dia montado com ?date=)", "Agenda"],
  ["post", "/blocks", "Cria bloco de um dia só ou recorrente", "Agenda"],
  ["patch", "/blocks/{id}", "Edita um bloco", "Agenda"],
  ["delete", "/blocks/{id}", "Exclui um bloco", "Agenda"],
  ["post", "/blocks/copy-day", "Copia os blocos de um dia para outro", "Agenda"],
  ["put", "/blocks/{id}/logs/{date}", "Marca bloco como concluído, parcial ou não feito", "Agenda"],
  ["get", "/compass/today", "Blocos de hoje ordenados, com o log do dia", "Compasso"],
  ["post", "/qp-sessions", "Inicia uma sessão QP", "Repetições QP"],
  ["patch", "/qp-sessions/{id}", "Encerra a sessão com o tempo realizado", "Repetições QP"],
  ["get", "/qp-sessions/summary", "Repetições QP por dia (?from=&to=)", "Repetições QP"],
  ["post", "/admin/auth/login", "Login de administradores", "Admin", "none"],
  ["post", "/admin/auth/refresh", "Renova o access token do painel", "Admin", "none"],
  ["post", "/admin/auth/logout", "Sai do painel", "Admin", "none"],
  ["get", "/admin/users", "Lista com busca, filtros e paginação", "Admin", "admin"],
  ["get", "/admin/users/{id}", "Detalhes do usuário", "Admin", "admin"],
  ["patch", "/admin/users/{id}/status", "Bloqueia ou desbloqueia", "Admin", "admin"],
  ["delete", "/admin/users/{id}", "Exclui o usuário", "Admin", "admin"],
  ["post", "/admin/users/{id}/resend", "Reenvia confirmação ou redefinição de senha", "Admin", "admin"],
  ["get", "/admin/dashboard", "Indicadores do dashboard", "Admin", "admin"],
  ["get", "/admin/reports/{type}", "Relatórios (cadastros | engajamento) com ?format=csv|pdf", "Admin", "admin"],
  ["get", "/admin/audit-logs", "Log de ações administrativas", "Admin", "admin"],
];

const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, tag, auth = "user"] of routes) {
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    tags: [tag],
    ...(auth === "none" ? { security: [] } : {}),
    parameters: [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    })),
    responses: { 200: { description: "OK" }, 400: { description: "Entrada inválida" }, 401: { description: "Não autenticado" } },
  };
}

export const openapi = {
  openapi: "3.0.3",
  info: { title: "Compasso: Agenda em Ritmo — API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  security: [{ bearer: [] }],
  paths,
};
