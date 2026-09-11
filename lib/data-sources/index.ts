/**
 * UK public-sector data source clients.
 *
 * All clients in this module:
 *   - Use the OGL v3 licence (Open Government Licence v3.0) unless noted
 *   - Require no API keys or external accounts
 *   - Return DataSourceResult<T> with full provenance metadata
 *   - Use govFetch() for timeout, user-agent, and non-throwing HTTP errors
 *
 * ESRS mapping:
 *   E1 (Climate):      ea-flood-monitoring, naei, defra-factors, carbon-intensity
 *   E2 (Air):          uk-air
 *   E3 (Water):        ea-water-quality, ea-catchment-planning, wri-aqueduct
 *   E4 (Biodiversity): natural-england-arcgis, nbn-atlas, gbif
 *   E5 (Waste):        ea-public-register (permit/exemption lookup), ewc-reference
 *   Legal Register:    legislation-gov-uk
 *   Cross-cutting:     ons-environmental (sector benchmarks), naei (national totals)
 *
 * Licence notes:
 *   - wri-aqueduct: CC BY 4.0 (World Resources Institute)
 *   - nbn-atlas: OGL v3 (NBN Trust)
 *   - gbif: CC0 1.0 (individual datasets may be CC BY)
 *   - carbon-intensity: OGL v3 (National Grid ESO)
 *   - legislation-gov-uk: OGL v3 (Crown Copyright)
 *   - ewc-reference: OGL v3 (static EA reference data)
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
export * from "./carbon-intensity";
export * from "./nbn-atlas";
export * from "./wri-aqueduct";
export * from "./ewc-reference";
export * from "./legislation-gov";
export * from "./gbif";
