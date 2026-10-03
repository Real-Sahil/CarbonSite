// @vitest-environment node
/**
 * Address search is for editors of the organisation only, validates its input,
 * and says so (503) when no key is configured, without leaking the key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const geo = vi.hoisted(() => ({ suggestAddresses: vi.fn() }));
vi.mock("@/lib/geo/address", async () => {
  const real = await vi.importActual<typeof import("@/lib/geo/address")>("@/lib/geo/address");
  return { ...real, suggestAddresses: geo.suggestAddresses };
});
const auth = vi.hoisted(() => ({ requireOrgMember: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: auth.requireOrgMember,
  ROLE_GROUPS: { editor: ["editor"] },
  AuthError: class AuthError extends Error {},
}));

import { GET } from "@/app/api/orgs/[orgId]/geocode/autocomplete/route";
import { GeocoderUnavailable } from "@/lib/geo/address";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const req = (q: string) => new NextRequest(`http://x/api?${q}`);

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "editor" } });
});

describe("address search route", () => {
  it("checks membership of the organisation in the URL with the editor roles", async () => {
    geo.suggestAddresses.mockResolvedValue([]);
    await GET(req("q=Mussafah"), ctx);
    expect(auth.requireOrgMember).toHaveBeenCalledWith("org-a", "editor");
  });
  it("sends only the typed text and country on, and returns the suggestions", async () => {
    geo.suggestAddresses.mockResolvedValue([{ label: "Mussafah" }]);
    const res = await GET(req("q=Mussafah%20Industrial&country=AE"), ctx);
    expect(res.status).toBe(200);
    expect(geo.suggestAddresses).toHaveBeenCalledWith("Mussafah Industrial", { country: "AE" });
    expect((await res.json()).suggestions).toHaveLength(1);
  });
  it("refuses text under three characters and a country that is not two letters, before any call", async () => {
    expect((await GET(req("q=ab"), ctx)).status).toBe(422);
    expect((await GET(req("q=abcd&country=UAE"), ctx)).status).toBe(422);
    expect(geo.suggestAddresses).not.toHaveBeenCalled();
  });
  it("answers 503 when the service or key is missing", async () => {
    geo.suggestAddresses.mockRejectedValue(new GeocoderUnavailable("No address search key is configured."));
    const res = await GET(req("q=Mussafah"), ctx);
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("key is configured");
  });
});
