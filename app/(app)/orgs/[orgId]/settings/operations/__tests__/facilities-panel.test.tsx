import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { FacilitiesPanel } from "../facilities-panel";

const suggestion = {
  label: "1 Phoenix Street, Derby DE1 1AA, United Kingdom",
  addressLine: "1 Phoenix Street",
  city: "Derby",
  region: "England",
  postcode: "DE1 1AA",
  country: "GB",
  latitude: 52.92,
  longitude: -1.47,
};

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
    url.includes("/geocode/")
      ? new Response(JSON.stringify({ suggestions: [suggestion] }), { status: 200 })
      : new Response(JSON.stringify({}), { status: init?.method ? 200 : 200 }),
  );
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); });

describe("FacilitiesPanel", () => {
  it("fills country, region and postcode from a chosen address and keeps only the street in the box", async () => {
    render(<FacilitiesPanel orgId="o" facilities={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /add facility/i }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Main Compound" } });
    fireEvent.change(screen.getByLabelText(/^Address/), { target: { value: "1 Phoenix" } });
    const option = await screen.findByRole("option", { name: /Phoenix Street/ }, { timeout: 2000 });
    fireEvent.mouseDown(option);

    expect((screen.getByLabelText(/^Address/) as HTMLInputElement).value).toBe("1 Phoenix Street");
    expect((screen.getByLabelText(/^Country/) as HTMLInputElement).value).toBe("GB");
    expect((screen.getByLabelText(/^Region/) as HTMLInputElement).value).toBe("England");
    expect((screen.getByLabelText(/^Postcode/) as HTMLInputElement).value).toBe("DE1 1AA");

    fireEvent.click(screen.getByRole("button", { name: /^add facility$/i, hidden: false }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeTruthy();
      expect(JSON.parse(post![1].body)).toMatchObject({
        name: "Main Compound", country: "GB", region: "England", postcode: "DE1 1AA",
        addressLine: "1 Phoenix Street", latitude: 52.92, longitude: -1.47,
      });
    });
  });

  it("says which sites are not on the map", () => {
    render(
      <FacilitiesPanel
        orgId="o"
        facilities={[
          { id: "f1", name: "Depot", country: "GB", region: "", addressLine: "", postcode: "", latitude: null, longitude: null, waterStressLevel: null, egridSubregion: "" },
        ]}
      />,
    );
    expect(screen.getByText(/0 of 1 placed on the site map/)).toBeTruthy();
    expect(screen.getByText(/Not on the site map/)).toBeTruthy();
  });

  it("suggests an eGRID subregion for a US site with a position, and saves it once confirmed", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/egrid-subregion")
        ? new Response(JSON.stringify({ suggestion: { kind: "suggested", code: "CAMX", agree: 5, of: 5, nearestKm: 3 } }), { status: 200 })
        : new Response(JSON.stringify({}), { status: 200 }),
    );
    render(
      <FacilitiesPanel
        orgId="o"
        facilities={[{ id: "f1", name: "LA yard", country: "US", region: "", addressLine: "", postcode: "", latitude: 34.05, longitude: -118.24, waterStressLevel: null, egridSubregion: "" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /use camx/i }));
    expect((screen.getByLabelText(/eGRID subregion/) as HTMLSelectElement).value).toBe("CAMX");
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(patch![1].body)).toMatchObject({ egridSubregion: "CAMX" });
    });
  });

  it("offers no subregion for a site outside the US", () => {
    render(<FacilitiesPanel orgId="o" facilities={[{ id: "f2", name: "Depot", country: "GB", region: "", addressLine: "", postcode: "", latitude: 52, longitude: -1, waterStressLevel: null, egridSubregion: "" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.queryByLabelText(/eGRID subregion/)).toBeNull();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/egrid-subregion"))).toBe(false);
  });
});
