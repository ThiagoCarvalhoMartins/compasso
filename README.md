# Compasso: Agenda em Ritmo

Aplicação web que divide o dia em blocos de tempo e mostra, em tempo real, em qual bloco você deveria estar e quanto falta para o próximo. Inspirada em *Inteligência Positiva* (Repetições QP), *Hábitos Atômicos* (óbvio, fácil, satisfatório) e *A Única Coisa* (blocos protegidos para o que mais importa).

## Estrutura

```
compasso/
├── apps/
│   ├── web/        # aplicação do usuário (React + Vite, PWA)       → http://localhost:5173
│   ├── admin/      # painel administrativo (React + Vite + Recharts) → http://localhost:5174
│   └── api/        # API REST Express + Prisma (MySQL)              → http://localhost:3000/api/v1
├── packages/
│   ├── ui/         # tema (Tailwind v4 + variáveis do shadcn/ui), componentes e cliente HTTP
│   └── shared/     # tipos, schemas Zod, textos pt-BR e regras de agenda (usados no front e na API)
└── .github/workflows/  # CI e deploy na Azure
```

## Como rodar localmente

Pré-requisitos: Node.js 22+, pnpm 9 (`corepack enable` ou `npm i -g pnpm@9`) e Docker (para o MySQL).

```bash
pnpm install
docker compose up -d                       # MySQL 8 local
cp apps/api/.env.example apps/api/.env     # ajuste JWT_SECRET e, se quiser, SEED_ADMIN_PASSWORD
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
pnpm db:generate                           # gera o Prisma Client
pnpm db:migrate                            # cria o banco e as tabelas (primeira execução)
pnpm db:seed                               # categorias padrão + primeiro administrador
pnpm dev                                   # sobe api, web e admin juntos
```

Sem `RESEND_API_KEY`, os e-mails (confirmação e redefinição de senha) são escritos no log da API — copie o link de lá. Sem `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`, o botão do Google não aparece.

A documentação OpenAPI fica em http://localhost:3000/api/v1/docs.

## Testes

```bash
pnpm test        # Vitest: regras de negócio (packages/shared) e endpoints (apps/api, Supertest)
pnpm typecheck
```

## Onde está cada requisito

| Requisito | Onde |
| --- | --- |
| RN03–RN10, RN14, RN16 (regras de agenda, alertas, QP) | `packages/shared/src/rules.ts`, `schemas.ts` (testes em `packages/shared/test`) |
| RN05/RN10/RN15 com banco | `apps/api/src/services/blocks.ts` |
| RF01 autenticação, RNF04 JWT + refresh em cookie httpOnly | `apps/api/src/routes/auth.ts`, `services/session.ts`, `lib/tokens.ts` |
| RF02 perfil, LGPD (exportar/excluir), RN13 | `apps/api/src/routes/me.ts`, `services/accounts.ts`, `apps/web/src/pages/Profile.tsx` |
| RF03 agenda | `apps/api/src/routes/blocks.ts`, `apps/web/src/pages/Agenda.tsx`, `components/BlockFormDialog.tsx` |
| RF04 tela Compasso, alertas, wake lock, virada do dia | `apps/web/src/pages/Compass.tsx`, `hooks/useAlerts.ts`, `hooks/useNow.ts`, `lib/audio.ts` |
| RF05 Repetições QP | `apps/web/src/components/Qp.tsx`, `apps/api/src/routes/qp.ts` |
| RF06–RF09 painel, auditoria, dashboard, relatórios CSV/PDF | `apps/api/src/routes/admin.ts`, `services/reports.ts`, `apps/admin/src` |
| RNF02 PWA | `apps/web/public/manifest.webmanifest`, `public/sw.js` |
| RNF11 Application Insights | `apps/api/src/index.ts` (ativa com `APPLICATIONINSIGHTS_CONNECTION_STRING`) |

### Decisões tomadas na implementação

- **Tabela extra `user_activity`** (usuário + dia): necessária para DAU/WAU/MAU e retenção, que o escopo define como "abriram a tela Compasso". É gravada pelo `GET /compass/today`.
- **Tokens de confirmação de e-mail e de redefinição de senha** são JWTs de uso único (o segredo inclui o estado atual do usuário), sem tabela extra.
- **`repeat_weekdays`** é guardado como texto `"1,3,5"` (0 = domingo).
- **Sons dos alertas** são sintetizados com a Web Audio API (sino, tigela tibetana, tom suave), sem arquivos de áudio.
- **Copiar dia** cria cópias "Apenas neste dia" na data de destino, validando sobreposição antes de gravar.
- **Exclusão de conta** anonimiza na hora (dentro dos 30 dias da RN13); sessões QP ficam sem dono, como métrica anônima.
- **Foto do perfil** é um link (URL). Upload de arquivo pediria Azure Blob Storage — fica para depois.

## Azure

| Componente | Serviço |
| --- | --- |
| apps/web | Azure Static Web Apps (Free) — `apps/web/public/staticwebapp.config.json` |
| apps/admin | Azure Static Web Apps (Free), instância separada em admin.agendaemritmo.com.br |
| apps/api | Azure App Service (Linux, Node 22) — startup: `npx prisma migrate deploy && node dist/index.js` |
| Banco | Azure Database for MySQL Flexible Server (Burstable B1ms) |
| Segredos | Azure Key Vault, referenciado nas App Settings do App Service via identidade gerenciada |
| Monitoramento | Application Insights |

O workflow `.github/workflows/deploy.yml` lista os segredos e variáveis que precisam ser criados no GitHub. Em produção, os front-ends e a API ficam em domínios diferentes, então o cookie de refresh usa `SameSite=None; Secure`, e `WEB_ORIGIN`/`ADMIN_ORIGIN` precisam apontar para os domínios reais (CORS).

## Próximos passos

- Testes de integração com banco real (MySQL no CI) e testes end-to-end com Playwright.
- 2FA no login do painel (RF06.1 recomenda).
- Mover os textos de interface para `packages/shared/src/i18n` (hoje só validação e erros estão centralizados).
- Backlog pós-MVP: Web Push, Google Calendar/Outlook, semanas A/B, sequências e gamificação, modo escuro.
