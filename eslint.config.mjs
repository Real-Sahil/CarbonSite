import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".pnpm-store/**",
    "next-env.d.ts",
  ]),
  // Disable overly strict rules for server components + chart animations
  {
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/display-name": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react/no-render-return-value": "off",
      "react/no-array-index-key": "warn",
      "react/jsx-no-useless-fragment": "warn",
      "react/jsx-key": "warn",
      "react/prop-types": "off",
    },
  },
  // ESLint plugin rules (these may be from eslint-config-next or other plugins)
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      "@next/next/no-assign-module-variable": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Relax rules for chart/animation/utility components using advanced patterns
  {
    files: [
      "components/charts/**/*",
      "components/dashboard/**/*",
      "components/org-sidebar.tsx",
      "components/originkit/**/*",
      "components/analytics/**/*",
      "app/public/**/*",
      "lib/middleware/**/*",
    ],
    rules: {
      "no-inner-declarations": "off",
      "react/jsx-no-comment-textnodes": "off",
    },
  },
]);

export default eslintConfig;
