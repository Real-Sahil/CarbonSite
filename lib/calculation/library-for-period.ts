type LibraryRef = { id: string; name: string; version: string };

function libraryYear(version: string): number | null {
  const year = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * DEFRA's guidance is to use one year's factor set for a whole reporting
 * period: the set for the year the period ends in, or the newest set published
 * before it. Falls back to the newest DEFRA set, then to any library.
 */
export function chooseFactorLibrary<T extends LibraryRef>(libraries: T[], periodEnd: Date): T | null {
  const endYear = periodEnd.getUTCFullYear();
  const defra = libraries
    .filter((l) => l.name === "DEFRA" && libraryYear(l.version) !== null)
    .sort((a, b) => (libraryYear(b.version)! - libraryYear(a.version)!) || b.version.localeCompare(a.version));

  return defra.find((l) => libraryYear(l.version)! <= endYear) ?? defra[0] ?? libraries[0] ?? null;
}

/**
 * Libraries worth offering for a new run: where a newer version of the same
 * year's set exists (DEFRA 2025.2 reloaded from the official flat file after
 * the hand-entered 2025.1), only the newest is kept. Superseded versions stay
 * in the database so the runs that used them still reproduce.
 */
/**
 * The newer version of the same year's set that replaces `used`, or null when
 * `used` is current. A snapshot calculated with a replaced set should be
 * recalculated: the newer version corrects its factors.
 */
export function supersedingLibrary<T extends LibraryRef>(used: LibraryRef, libraries: T[]): T | null {
  const year = libraryYear(used.version);
  const newer = libraries
    .filter((l) => l.name === used.name && l.id !== used.id && libraryYear(l.version) === year)
    .filter((l) => l.version.localeCompare(used.version, undefined, { numeric: true }) > 0)
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return newer[0] ?? null;
}

export function currentFactorLibraries<T extends LibraryRef>(libraries: T[]): T[] {
  const newest = new Map<string, T>();
  for (const lib of libraries) {
    const key = `${lib.name}:${libraryYear(lib.version) ?? lib.version}`;
    const seen = newest.get(key);
    if (!seen || lib.version.localeCompare(seen.version, undefined, { numeric: true }) > 0) newest.set(key, lib);
  }
  return libraries.filter((l) => newest.get(`${l.name}:${libraryYear(l.version) ?? l.version}`) === l);
}
