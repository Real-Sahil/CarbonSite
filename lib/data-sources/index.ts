/**
 * UK public-sector data source clients.
 *
 * All clients in this module:
 *   - Use the OGL v3 licence (Open Government Licence v3.0)
 *   - Require no API keys or external accounts
 *   - Return DataSourceResult<T> with full provenance metadata
 *   - Use govFetch() for timeout, user-agent, and non-throwing HTTP errors
 *
 * ESRS mapping:
 *   E1 (Climate): ea-flood-monitoring, naei, defra-factors
 *   E2 (Air):     uk-air
 *   E3 (Water):   ea-water-quality, ea-catchment-planning
 *   E4 (Biodiversity): natural-england-arcgis
 *   E5 (Waste):   ea-public-register (permit/exemption lookup)
 *   Cross-cutting: ons-environmental (sector benchmarks), naei (national totals)
 */

export * from "./types";
export * from "./ea-flood-monitoring";
export * from "./ea-public-register";
export * from "./ea-water-quality";
export * from "./ea-catchment-planning";
export * from "./natural-england-arcgis";
export * from "./uk-air";
export * from "./ons-environmental";
export * from "./naei";
export * from "./defra-factors";
