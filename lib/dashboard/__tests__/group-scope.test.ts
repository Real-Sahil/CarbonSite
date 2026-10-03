import { describe, expect, it } from "vitest";
import { entityWithDescendants, facilityCountries, facilityScope } from "../group-scope";

const entities = [
  { id: "group", parentId: null },
  { id: "uk", parentId: "group" },
  { id: "uk-sub", parentId: "uk" },
  { id: "ae", parentId: "group" },
];
const facilities = [
  { id: "f1", country: "United Kingdom", legalEntityId: "uk" },
  { id: "f2", country: "GB", legalEntityId: "uk-sub" },
  { id: "f3", country: "AE", legalEntityId: "ae" },
  { id: "f4", country: "Narnia", legalEntityId: null },
];

describe("group scope", () => {
  it("includes subsidiaries of an entity", () => {
    expect([...entityWithDescendants(entities, "uk")].sort()).toEqual(["uk", "uk-sub"]);
  });
  it("does not loop on a cycle", () => {
    expect(entityWithDescendants([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], "a").size).toBe(2);
  });
  it("is null with no filter, so nothing is scoped", () => {
    expect(facilityScope(facilities, entities, {})).toBeNull();
  });
  it("scopes by entity, by country (names and codes alike), and by both", () => {
    expect(facilityScope(facilities, entities, { entityId: "uk" })).toEqual(["f1", "f2"]);
    expect(facilityScope(facilities, entities, { country: "GB" })).toEqual(["f1", "f2"]);
    expect(facilityScope(facilities, entities, { entityId: "group", country: "AE" })).toEqual(["f3"]);
  });
  it("gives an empty list, not null, when a filter matches nothing", () => {
    expect(facilityScope(facilities, entities, { entityId: "nope" })).toEqual([]);
    expect(facilityScope(facilities, entities, { country: "JP" })).toEqual([]);
  });
  it("lists distinct countries, most facilities first", () => {
    expect(facilityCountries(facilities)).toEqual(["GB", "AE"]);
  });
});
