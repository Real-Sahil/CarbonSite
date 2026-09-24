import { describe, expect, it } from "vitest";
import { pickHeatNetwork } from "../heat-network";

const f = (externalId: string, activityType: string, usageNotes: string) => ({ externalId, activityType, usageNotes });
const DEFAULT = f("ademe-14", "purchased_heat", "France district heating, average of other networks (ADEME 14).");
const COOL_DEFAULT = f("ademe-17", "district_cooling", "France district cooling, average of other networks (ADEME 17).");
const DEFENSE = f("ademe-15", "heat_network", 'Heat network "92, Courbevoie, Réseau de La Défense" (Île-de-France; ADEME 15). Per kWh delivered.');
const DEFENSE_COLD = f("ademe-16", "cooling_network", 'Cooling network "92, Courbevoie, Réseau de La Défense" (Île-de-France; ADEME 16). Per kWh delivered.');
const ALL = [DEFAULT, COOL_DEFAULT, DEFENSE, DEFENSE_COLD];

describe("heat network selection", () => {
  it("uses a named network only when the record names it, ignoring case and accents", () => {
    expect(pickHeatNetwork(ALL, "92, courbevoie, reseau de la defense")).toEqual({ kind: "matched", factor: DEFENSE });
    expect(pickHeatNetwork(ALL, "ADEME 16")).toEqual({ kind: "matched", factor: DEFENSE_COLD });
  });

  it("takes the cooling network of that name when the record says cooling", () => {
    expect(pickHeatNetwork(ALL, "92, Courbevoie, Réseau de La Défense froid")).toEqual({ kind: "matched", factor: DEFENSE_COLD });
  });

  it("otherwise drops every named network so the national default is used, never an arbitrary network", () => {
    expect(pickHeatNetwork(ALL, null)).toEqual({ kind: "rest", candidates: [DEFAULT, COOL_DEFAULT] });
    expect(pickHeatNetwork(ALL, "Réseau")).toEqual({ kind: "rest", candidates: [DEFAULT, COOL_DEFAULT] });
    expect(pickHeatNetwork([DEFAULT], "anything")).toEqual({ kind: "rest", candidates: [DEFAULT] });
  });
});
