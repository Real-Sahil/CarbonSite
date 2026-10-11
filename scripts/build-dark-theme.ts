// Writes app/dark-theme.generated.css from Tailwind's palette and the hex
// classes the source uses. Run `pnpm theme:build` after adding a hex class;
// lib/theme/__tests__/dark-css.test.ts fails while the committed file is stale.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDarkCss, collectHexTokens } from "../lib/theme/dark-css";

const root = process.cwd();
const themeCss = readFileSync(join(root, "node_modules/tailwindcss/theme.css"), "utf8");
const css = buildDarkCss(themeCss, collectHexTokens(root));
writeFileSync(join(root, "app/dark-theme.generated.css"), css);
console.log(`Wrote app/dark-theme.generated.css (${css.split("\n").length} lines)`);
