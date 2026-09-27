// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() });
  return new Proxy({} as Record<string, ReturnType<typeof model>>, { get: (t, k: string) => (t[k] ??= model()) });
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "user-a" } }, membership: { role: "contract_manager" } };
  return { ...actual, requireSession: vi.fn().mockResolvedValue(ctx.session), requireOrgMember: vi.fn().mockResolvedValue(ctx) };
});

import { TOPICS, getTopic } from "../topics";
import { CAS_V5 } from "../catalogue/cas";
import { customTopicKey, isAnswerKey, parseQuestions, suggestTopic } from "../match";
import { draftAnswer, type PqqContext } from "../draft";

const req = (body: unknown, method = "POST") => new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => vi.clearAllMocks());

describe("answer topics and the Common Assessment Standard map", () => {
  it("has unique topic keys", () => {
    expect(new Set(TOPICS.map((t) => t.key)).size).toBe(TOPICS.length);
  });

  it("maps every CAS v5 question, 1 to 176, to a topic and carries no question text", () => {
    expect(CAS_V5.questions.map((q) => Number(q.ref))).toEqual(Array.from({ length: 176 }, (_, i) => i + 1));
    for (const q of CAS_V5.questions) {
      expect(getTopic(q.topicKey), `question ${q.ref}`).not.toBeNull();
      expect(q.text).toBeUndefined();
    }
    expect(CAS_V5.questions.find((q) => q.ref === "120")?.topicKey).toBe("env.carbon_reduction_plan");
    expect(CAS_V5.questions.find((q) => q.ref === "161")?.topicKey).toBe("infosec.cyber_essentials");
  });
});

describe("client questionnaires", () => {
  it("splits pasted questions with their references", () => {
    expect(parseQuestions("1.1 Do you hold ISO 14001?\nQ2) Employer's liability cover\n\nWhat is your turnover")).toEqual([
      { ref: "1.1", text: "Do you hold ISO 14001?" },
      { ref: "Q2", text: "Employer's liability cover" },
      { ref: "3", text: "What is your turnover" },
    ]);
  });

  it("suggests the topic already answered elsewhere, or none", () => {
    expect(suggestTopic("Please confirm your employers liability insurance and limit")).toBe("financial.employers_liability");
    expect(suggestTopic("Are you certified to ISO 45001:2018?")).toBe("hs.iso45001");
    expect(suggestTopic("Provide a copy of your Carbon Reduction Plan in line with PPN 06/21")).toBe("env.carbon_reduction_plan");
    expect(suggestTopic("Describe your approach to lunar mining")).toBeNull();
    const own = customTopicKey("Describe your approach to lunar mining");
    expect(isAnswerKey(own)).toBe(true);
    expect(customTopicKey("  describe your approach to LUNAR mining ")).toBe(own);
    expect(isAnswerKey("custom:../../etc")).toBe(false);
  });

  it("saves a questionnaire to the caller's organisation only, with known topics", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/pqq/sets/route");
    db.pqqQuestionSet.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "s1", ...data }));
    const ok = await POST(req({ name: "Framework PQQ", questions: [{ ref: "1", text: "ISO 14001?", topicKey: "env.iso14001" }], organizationId: "org-b" }), { params: Promise.resolve({ orgId: "org-a" }) });
    expect(ok.status).toBe(422);
    const res = await POST(req({ name: "Framework PQQ", questions: [{ ref: "1", text: "ISO 14001?", topicKey: "env.iso14001" }] }), { params: Promise.resolve({ orgId: "org-a" }) });
    expect(res.status).toBe(201);
    expect(db.pqqQuestionSet.create.mock.calls[0][0].data.organizationId).toBe("org-a");
    expect((await POST(req({ name: "X", questions: [{ ref: "1", text: "?", topicKey: "made.up" }] }), { params: Promise.resolve({ orgId: "org-a" }) })).status).toBe(422);
  });
});

describe("answers", () => {
  it("refuses documents from another organisation", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/pqq/answers/[topicKey]/route");
    db.evidenceFile.count.mockResolvedValue(0);
    const res = await PUT(req({ response: "yes", evidenceFileIds: ["ev-other"] }, "PUT"), { params: Promise.resolve({ orgId: "org-a", topicKey: "hs.policy" }) });
    expect(res.status).toBe(404);
    expect(db.evidenceFile.count.mock.calls[0][0].where).toEqual({ organizationId: "org-a", id: { in: ["ev-other"] } });
    expect(db.pqqAnswer.upsert).not.toHaveBeenCalled();
  });

  it("saves an answer against the organisation and topic", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/pqq/answers/[topicKey]/route");
    db.evidenceFile.count.mockResolvedValue(1);
    db.pqqAnswer.upsert.mockImplementation(async ({ create }: { create: object }) => ({ id: "a1", updatedAt: new Date(), evidenceFileIds: [], ...create }));
    const res = await PUT(req({ response: "yes", answer: "Signed policy attached", evidenceFileIds: ["ev1"] }, "PUT"), { params: Promise.resolve({ orgId: "org-a", topicKey: "hs.policy" }) });
    expect(res.status).toBe(200);
    expect(db.pqqAnswer.upsert.mock.calls[0][0].where).toEqual({ organizationId_topicKey: { organizationId: "org-a", topicKey: "hs.policy" } });
    expect((await PUT(req({ answer: "x" }, "PUT"), { params: Promise.resolve({ orgId: "org-a", topicKey: "nope" }) })).status).toBe(404);
  });
});

describe("drafts from records", () => {
  const ctx: PqqContext = {
    orgName: "Northgate Civils Ltd",
    entities: [{ name: "Northgate Civils Ltd", registrationNumber: "01234567" }],
    certificates: {
      "iso-14001-2026": { status: "certified", certificateNumber: "EMS 123", certificationBody: "Cert Co", certifiedUntil: new Date("2028-05-01"), percent: 100 },
      "iso-9001-2026": { status: "implementing", certificateNumber: null, certificationBody: null, certifiedUntil: null, percent: 40 },
    },
    documents: [{ title: "Health and Safety Policy", category: null, version: 4, approvedOn: new Date("2026-02-01"), reviewOn: new Date("2027-02-01"), kind: "policy" }],
    training: { people: 12, records: 30, expired: 1, expiring: 2, competences: ["CSCS", "SMSTS"], cardHolders: 10 },
    incidents: { since: new Date("2023-09-27"), total: 14, riddor: 1, lostTime: 2, nearMiss: 9 },
    suppliers: { evaluated: 0, approved: 0, lastOn: null },
    checks: { auditsCompleted: 0, lastAuditOn: null, lastReviewOn: null, closedActions: 0, inspections: 0 },
    records: { risks: 0, methodStatements: 0, legalRegister: 0, aspects: 0, permits: 0 },
    carbon: { period: "FY2025", totalT: 1234.5, crpPeriod: null, crpStatus: null, crpUrl: null },
    gdprAdopted: false,
  };

  it("drafts only what the records hold", () => {
    expect(draftAnswer(getTopic("env.iso14001")!, ctx)).toEqual({ response: "yes", answer: "Yes. Certified to ISO 14001 by Cert Co, certificate EMS 123, valid until 2028-05-01." });
    expect(draftAnswer(getTopic("quality.iso9001")!, ctx)?.answer).toBe("No. We are working towards ISO 9001; 40% of its requirements are implemented.");
    expect(draftAnswer(getTopic("hs.policy")!, ctx)?.answer).toContain("Health and Safety Policy (version 4, approved 2026-02-01");
    expect(draftAnswer(getTopic("hs.accidents")!, ctx)?.answer).toContain("14 incidents, including 9 near misses, 2 lost time injuries and 1 reportable under RIDDOR");
    expect(draftAnswer(getTopic("env.carbon_reporting")!, ctx)?.answer).toContain("FY2025, total 1,234.5 tCO2e");
    expect(draftAnswer(getTopic("identity.company_number")!, ctx)?.answer).toBe("Northgate Civils Ltd: 01234567");
    // Nothing on record: no draft rather than an invented answer.
    expect(draftAnswer(getTopic("corporate.anti_bribery")!, ctx)).toBeNull();
    expect(draftAnswer(getTopic("hs.subcontractors")!, ctx)).toBeNull();
    expect(draftAnswer(getTopic("env.carbon_reduction_plan")!, ctx)).toBeNull();
    expect(draftAnswer(getTopic("infosec.cyber_essentials")!, ctx)).toBeNull();
  });
});
