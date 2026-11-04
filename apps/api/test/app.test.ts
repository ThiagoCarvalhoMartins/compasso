import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/lib/tokens";
import { dayBoundsUtc, todayIn } from "../src/lib/time";

// Testes que não precisam de banco: validação de entrada, autenticação e autorização.
const app = createApp();

describe("API", () => {
  it("responde ao health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("publica a especificação OpenAPI", async () => {
    const res = await request(app).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.paths["/compass/today"]).toBeDefined();
  });

  it("valida o cadastro antes de tocar no banco (RN02, RN03, RNF07)", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Ana",
      email: "ana@exemplo.com",
      password: "semnumero",
      birthDate: "2020-01-01",
      acceptPrivacy: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(["password", "birthDate"]));
  });

  it("exige JWT nas rotas do usuário", async () => {
    const res = await request(app).get("/api/v1/compass/today");
    expect(res.status).toBe(401);
  });

  it("rejeita bloco que atravessa a meia-noite (RN06)", async () => {
    const token = signAccessToken({ sub: "u1", role: "USER" });
    const res = await request(app)
      .post("/api/v1/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Plantão", color: "#B9D3E3", recurrence: "ONCE", date: "2099-01-01", startTime: "23:00", endTime: "01:00" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.endTime).toBeDefined();
  });

  it("exige scope e date juntos ao excluir parte de um recorrente", async () => {
    const token = signAccessToken({ sub: "u1", role: "USER" });
    const res = await request(app).delete("/api/v1/blocks/x?scope=single").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.date).toBeDefined();
  });

  it("bloqueia o painel para usuários comuns (RF06.2)", async () => {
    const token = signAccessToken({ sub: "u1", role: "USER" });
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("Suporte não pode bloquear contas (RF06.2)", async () => {
    const token = signAccessToken({ sub: "s1", role: "SUPPORT" });
    const res = await request(app)
      .patch("/api/v1/admin/users/x/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "BLOCKED" });
    expect(res.status).toBe(403);
  });
});

describe("fuso horário (RN09/RN12)", () => {
  it("calcula o dia local e seus limites em UTC", () => {
    const instant = new Date("2026-11-03T02:30:00Z"); // 23:30 de 02/11 em São Paulo (UTC-3)
    expect(todayIn("America/Sao_Paulo", instant)).toBe("2026-11-02");
    const { start, end } = dayBoundsUtc("2026-11-02", "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-03T03:00:00.000Z");
  });
});
