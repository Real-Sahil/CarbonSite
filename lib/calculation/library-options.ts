import { chooseFactorLibrary } from "./library-for-period";

export type LibraryOption = { id: string; name: string; version: string };

function year(version: string): string {
  return version.split(".")[0] ?? version;
}

export function describeLibrary(lib: LibraryOption, recommendedId: string | null): string {
  const y = year(lib.version);
  if (lib.name === "EPA") return `US EPA ${y} (for US operations)`;
  if (lib.name === "NGA Factors") return `Australia NGA ${y} (for Australian operations)`;
  if (lib.name === "ECCC") return `Canada ECCC ${lib.version} electricity (other records use DEFRA)`;
  if (lib.name === "UBA") return `Germany UBA ${lib.version} (for German operations)`;
  if (lib.name === "SEAI") return `Ireland SEAI ${y} (for Irish operations)`;
  if (lib.name === "DEFRA") {
    return lib.id === recommendedId ? `DEFRA ${y} (UK, recommended)` : `DEFRA ${y} (UK, for periods ending ${y})`;
  }
  return `${lib.name} ${lib.version}`;
}

/** Why the chosen library is not the recommended one for this period, or null when it is. */
export function libraryMismatch(
  chosen: LibraryOption | undefined,
  recommended: LibraryOption | null,
  periodEnd: Date,
): string | null {
  if (!chosen || !recommended || chosen.id === recommended.id) return null;
  const endYear = periodEnd.getUTCFullYear();
  const rec = `DEFRA ${year(recommended.version)}`;
  if (chosen.name === "EPA") {
    return `US EPA factors describe US grids, fuels and transport. Use them only for activity in the US; for UK activity, ${rec} is recommended.`;
  }
  const nationalOf: Record<string, string> = { "NGA Factors": "Australian", ECCC: "Canadian", UBA: "German", SEAI: "Irish" };
  if (nationalOf[chosen.name]) {
    return `${chosen.name} ${chosen.version} describes ${nationalOf[chosen.name]} grids and fuels. Use it only for activity there; for UK activity, ${rec} is recommended.`;
  }
  return `This period ends in ${endYear}, so ${rec} is recommended. ${chosen.name} ${year(chosen.version)} will apply ${year(chosen.version)} factors to the whole period.`;
}

export function recommendedLibrary(libraries: LibraryOption[], periodEnd: Date | null): LibraryOption | null {
  return periodEnd ? chooseFactorLibrary(libraries, periodEnd) : null;
}
