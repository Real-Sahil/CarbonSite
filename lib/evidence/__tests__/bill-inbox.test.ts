// @vitest-environment node
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { emailOf, newInboxToken, tokenFromRecipients, verifySvix } from "../bill-inbox";

const SECRET_BYTES = Buffer.from("test-secret-bytes-for-svix");
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;
const sign = (id: string, ts: string, body: string) =>
  `v1,${createHmac("sha256", SECRET_BYTES).update(`${id}.${ts}.${body}`).digest("base64")}`;

describe("verifySvix", () => {
  const body = '{"type":"email.received"}';
  const now = 1_790_000_000;
  const ts = String(now);

  it("accepts a correct signature among several", () => {
    expect(verifySvix(SECRET, { id: "msg_1", timestamp: ts, signature: `v1,bm90LWl0 ${sign("msg_1", ts, body)}` }, body, now)).toBe(true);
  });

  it("rejects a changed body, a wrong secret and an old timestamp", () => {
    const sig = sign("msg_1", ts, body);
    expect(verifySvix(SECRET, { id: "msg_1", timestamp: ts, signature: sig }, body + " ", now)).toBe(false);
    expect(verifySvix(`whsec_${Buffer.from("other").toString("base64")}`, { id: "msg_1", timestamp: ts, signature: sig }, body, now)).toBe(false);
    expect(verifySvix(SECRET, { id: "msg_1", timestamp: ts, signature: sig }, body, now + 301)).toBe(false);
    expect(verifySvix(SECRET, { id: null, timestamp: ts, signature: sig }, body, now)).toBe(false);
  });
});

describe("inbox addresses", () => {
  it("reads the sender's address", () => {
    expect(emailOf("Sam Hartley <Sam@Northgate.co.uk>")).toBe("sam@northgate.co.uk");
    expect(emailOf("not an address")).toBeNull();
  });

  it("finds the inbox token among the recipients", () => {
    expect(tokenFromRecipients(["ops@acme.com", "Bills <bills-abc234xyz9@in.metricora.co.uk>"], "in.metricora.co.uk")).toBe("bills-abc234xyz9");
    expect(tokenFromRecipients(["bills-abc234xyz9@elsewhere.com"], "in.metricora.co.uk")).toBeNull();
    expect(tokenFromRecipients(["admin@in.metricora.co.uk"], "in.metricora.co.uk")).toBeNull();
  });

  it("makes tokens the recipient parser accepts", () => {
    const token = newInboxToken();
    expect(token).toMatch(/^bills-[a-z0-9]{10}$/);
    expect(tokenFromRecipients([`${token}@x.example`], "x.example")).toBe(token);
  });
});
