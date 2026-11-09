import { describe, expect, it } from "vitest";
import {
  ageOn,
  blockInputSchema,
  blocksForDate,
  compassState,
  findOneThingConflict,
  findOverlap,
  formatCountdown,
  passwordSchema,
  planAlerts,
  seriesHasOccurrences,
  startOfWeek,
  summarizeBlockDays,
  validateBlockTimes,
  weekdayOf,
  type BlockLike,
} from "../src";

const once = (date: string, startTime: string, endTime: string, extra: Partial<BlockLike> = {}): BlockLike => ({
  recurrence: "ONCE",
  date,
  repeatWeekdays: [],
  startsOn: null,
  startTime,
  endTime,
  ...extra,
});

const repeat = (days: number[], startsOn: string, startTime: string, endTime: string, extra: Partial<BlockLike> = {}): BlockLike => ({
  recurrence: "REPEAT",
  date: null,
  repeatWeekdays: days,
  startsOn,
  startTime,
  endTime,
  ...extra,
});

describe("datas", () => {
  it("calcula o dia da semana sem depender do fuso", () => {
    expect(weekdayOf("2026-11-02")).toBe(1); // segunda
    expect(weekdayOf("2026-11-08")).toBe(0); // domingo
  });

  it("começa a semana na segunda", () => {
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
  });

  it("RN02: calcula a idade completa", () => {
    expect(ageOn("2013-11-02", "2026-11-02")).toBe(13);
    expect(ageOn("2013-11-03", "2026-11-02")).toBe(12);
  });
});

describe("RN03 senha", () => {
  it("exige 8 caracteres com letras e números", () => {
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("abc123").success).toBe(false);
  });
});

describe("RN04/RN06 horários do bloco", () => {
  it("exige fim depois do início e duração mínima de 5 min", () => {
    expect(validateBlockTimes("09:00", "09:05")).toBeNull();
    expect(validateBlockTimes("09:00", "09:04")).toBe("minDuration");
    expect(validateBlockTimes("09:00", "09:00")).toBe("endAfterStart");
    expect(validateBlockTimes("23:00", "01:00")).toBe("endAfterStart");
  });

  it("valida recorrência no schema", () => {
    const base = { title: "Estudo", color: "#F4C9B0", startTime: "08:00", endTime: "09:00" };
    expect(blockInputSchema.safeParse({ ...base, recurrence: "ONCE" }).success).toBe(false);
    expect(blockInputSchema.safeParse({ ...base, recurrence: "ONCE", date: "2026-11-02" }).success).toBe(true);
    expect(blockInputSchema.safeParse({ ...base, recurrence: "REPEAT", startsOn: "2026-11-02" }).success).toBe(false);
    expect(
      blockInputSchema.safeParse({ ...base, recurrence: "REPEAT", startsOn: "2026-11-02", repeatWeekdays: [1, 3] }).success,
    ).toBe(true);
  });
});

describe("montagem do dia", () => {
  const blocks = [
    repeat([1, 2, 3, 4, 5], "2026-11-02", "09:00", "12:00", { id: "trabalho" }),
    once("2026-11-03", "07:00", "08:00", { id: "corrida" }),
    repeat([1], "2026-11-09", "14:00", "15:00", { id: "futuro" }),
  ];

  it("soma recorrentes e blocos de um dia só, ordenados", () => {
    expect(blocksForDate(blocks, "2026-11-03").map((b) => b.id)).toEqual(["corrida", "trabalho"]);
  });

  it("RN16: recorrente só vale a partir de starts_on", () => {
    expect(blocksForDate(blocks, "2026-11-02").map((b) => b.id)).toEqual(["trabalho"]);
    expect(blocksForDate(blocks, "2026-11-09").map((b) => b.id)).toEqual(["trabalho", "futuro"]);
  });
});

describe("exclusão parcial de recorrentes", () => {
  // Toda segunda a partir de 02/11/2026
  const base = { id: "a", title: "Inglês" };
  const monday = (extra: Partial<BlockLike> = {}) => repeat([1], "2026-11-02", "09:00", "10:00", { ...base, ...extra });

  it("apenas este: some só no dia excluído", () => {
    const block = monday({ excludedDates: ["2026-11-09"] });
    expect(blocksForDate([block], "2026-11-02")).toHaveLength(1);
    expect(blocksForDate([block], "2026-11-09")).toHaveLength(0);
    expect(blocksForDate([block], "2026-11-16")).toHaveLength(1);
  });

  it("este e os seguintes: some a partir do corte, mantendo os anteriores", () => {
    const block = monday({ endsOn: "2026-11-08" });
    expect(blocksForDate([block], "2026-11-02")).toHaveLength(1);
    expect(blocksForDate([block], "2026-11-09")).toHaveLength(0);
    expect(blocksForDate([block], "2026-11-16")).toHaveLength(0);
  });

  it("libera o horário do dia excluído para um bloco de um dia só", () => {
    const block = monday({ excludedDates: ["2026-11-09"] });
    expect(findOverlap(once("2026-11-09", "09:00", "10:00"), [block])).toBeNull();
    expect(findOverlap(once("2026-11-16", "09:00", "10:00"), [block])).not.toBeNull();
  });

  it("recorrente novo não conflita com série encerrada antes dele", () => {
    const ended = monday({ endsOn: "2026-11-08" });
    expect(findOverlap(repeat([1], "2026-11-09", "09:00", "10:00"), [ended])).toBeNull();
    expect(findOverlap(repeat([1], "2026-11-02", "09:00", "10:00"), [ended])).not.toBeNull();
  });

  it("recorrentes com períodos em comum só conflitam se caírem no mesmo dia", () => {
    const ended = monday({ endsOn: "2026-11-03" });
    // O período coincide em 02–03/11, mas a quarta só começa a contar depois do fim da série.
    expect(findOverlap(repeat([3], "2026-11-02", "09:00", "10:00"), [ended])).toBeNull();
  });

  it("detecta a série sem nenhum dia restante", () => {
    expect(seriesHasOccurrences(monday())).toBe(true);
    expect(seriesHasOccurrences(monday({ excludedDates: ["2026-11-02"] }))).toBe(true);
    expect(seriesHasOccurrences(monday({ endsOn: "2026-11-01" }))).toBe(false);
    expect(seriesHasOccurrences(monday({ endsOn: "2026-11-09", excludedDates: ["2026-11-02", "2026-11-09"] }))).toBe(false);
  });
});

describe("RN05 sobreposição", () => {
  const existing = [
    repeat([1, 3], "2026-11-02", "09:00", "10:00", { id: "a", title: "Inglês" }),
    once("2026-11-04", "18:00", "19:00", { id: "b", title: "Médico" }),
  ];

  it("detecta conflito entre ONCE e recorrente", () => {
    expect(findOverlap(once("2026-11-04", "09:30", "10:30"), existing)?.id).toBe("a");
    expect(findOverlap(once("2026-11-03", "09:30", "10:30"), existing)).toBeNull();
  });

  it("permite blocos encostados", () => {
    expect(findOverlap(once("2026-11-04", "10:00", "11:00"), existing)).toBeNull();
  });

  it("detecta conflito entre recorrente e ONCE futuro", () => {
    expect(findOverlap(repeat([3], "2026-11-02", "18:30", "20:00"), existing)?.id).toBe("b");
    expect(findOverlap(repeat([3], "2026-11-05", "18:30", "20:00"), existing)).toBeNull();
  });

  it("ignora o próprio bloco ao editar", () => {
    expect(findOverlap({ ...existing[0], id: "a", startTime: "09:30" }, existing)).toBeNull();
  });
});

describe("RN10 A Única Coisa", () => {
  it("permite apenas uma por dia", () => {
    const existing = [repeat([1], "2026-11-02", "08:00", "09:00", { id: "x", isOneThing: true })];
    expect(findOneThingConflict(once("2026-11-09", "10:00", "11:00", { isOneThing: true }), existing)?.id).toBe("x");
    expect(findOneThingConflict(once("2026-11-10", "10:00", "11:00", { isOneThing: true }), existing)).toBeNull();
  });
});

describe("alertas", () => {
  it("RN07: bloco de até 5 min não tem alerta de fim", () => {
    const alerts = planAlerts([once("2026-11-02", "09:00", "09:05")], 5);
    expect(alerts.map((a) => a.kind)).toEqual(["start"]);
  });

  it("toca o aviso de fim 5 min antes", () => {
    const alerts = planAlerts([once("2026-11-02", "09:00", "10:00")], 5);
    expect(alerts.map((a) => [a.kind, a.minute])).toEqual([
      ["start", 540],
      ["end", 595],
    ]);
  });

  it("RN08: aviso de fim no mesmo minuto de um início toca só o início", () => {
    const alerts = planAlerts([once("2026-11-02", "09:00", "10:00"), once("2026-11-02", "10:00", "11:00")], 5);
    expect(alerts.filter((a) => a.minute === 600).map((a) => a.kind)).toEqual(["start"]);
    expect(alerts.map((a) => a.minute)).toEqual([540, 595, 600, 655]);
  });
});

describe("tela Compasso", () => {
  const day = [once("2026-11-02", "09:00", "10:00", { id: "a" }), once("2026-11-02", "11:00", "12:00", { id: "b" })];

  it("calcula bloco atual, próximo e progresso", () => {
    const s = compassState(day, 9 * 3600 + 30 * 60);
    expect(s.current?.id).toBe("a");
    expect(s.next?.id).toBe("b");
    expect(s.currentProgress).toBeCloseTo(0.5);
    expect(s.secondsToCurrentEnd).toBe(1800);
    expect(s.dayProgress).toBeCloseTo(1 / 6);
  });

  it("RF04.5: tempo livre entre blocos", () => {
    const s = compassState(day, 10 * 3600 + 30 * 60);
    expect(s.isFreeTime).toBe(true);
    expect(s.secondsToNext).toBe(1800);
  });

  it("formata contagem regressiva", () => {
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });
});

describe("resumo diário dos blocos (Analytics)", () => {
  it("conta planejados e status por dia, ignorando logs de dias em que o bloco não vale", () => {
    // 2026-11-09 é segunda; a série vale seg e qua.
    const blocks = [
      { id: "b", title: "Leitura", color: "#00f", ...once("2026-11-09", "10:00", "11:00") },
      { id: "a", title: "Treino", color: "#f00", ...repeat([1, 3], "2026-11-09", "08:00", "09:00") },
    ];
    const treino = { blockId: "a", title: "Treino", color: "#f00", startTime: "08:00", endTime: "09:00" };
    const leitura = { blockId: "b", title: "Leitura", color: "#00f", startTime: "10:00", endTime: "11:00" };
    const logs = [
      { blockId: "a", date: "2026-11-09", status: "DONE" as const },
      { blockId: "b", date: "2026-11-09", status: "SKIPPED" as const },
      { blockId: "a", date: "2026-11-10", status: "DONE" as const }, // terça: fora da série
      { blockId: "a", date: "2026-11-11", status: "PARTIAL" as const },
    ];
    expect(summarizeBlockDays(blocks, logs, ["2026-11-09", "2026-11-10", "2026-11-11"])).toEqual([
      {
        date: "2026-11-09",
        planned: 2,
        done: 1,
        partial: 0,
        skipped: 1,
        // Pela ordem de início, não pela ordem da lista.
        marked: [
          { ...treino, status: "DONE" },
          { ...leitura, status: "SKIPPED" },
        ],
      },
      { date: "2026-11-10", planned: 0, done: 0, partial: 0, skipped: 0, marked: [] },
      { date: "2026-11-11", planned: 1, done: 0, partial: 1, skipped: 0, marked: [{ ...treino, status: "PARTIAL" }] },
    ]);
  });
});
