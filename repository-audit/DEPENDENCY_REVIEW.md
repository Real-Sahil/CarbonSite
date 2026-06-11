# Dependency Review — CarbonSite

---

## Web / Next.js Dependencies

### Production Dependencies

| Package | Version | Purpose | Status | Concerns | Recommendation |
|---|---|---|---|---|---|
| `next` | 16.2.7 | Full-stack React framework | Current | Pinned to exact version (no ^ range) — safe | Keep; add auto-upgrade workflow |
| `react` | 19.2.4 | UI library | Current stable | — | Keep |
| `react-dom` | 19.2.4 | DOM renderer | Current stable | — | Keep |
| `@prisma/client` | ^6.3.0 | ORM client | Current | Must match `prisma` devDep version | Keep |
| `better-auth` | ^1.2.8 | Authentication | Current | Relatively new library, API still stabilizing | Keep; monitor breaking changes |
| `zod` | ^3.24.2 | Input validation | Current stable | — | Keep |
| `pg-boss` | ^12.18.2 | Postgres-backed job queue | Current | Major version = breaking changes likely | Pin minor: `^12.18` |
| `@aws-sdk/client-s3` | ^3.775.0 | S3/R2 API client | Current | Large bundle — only used server-side (fine) | Keep |
| `@aws-sdk/s3-request-presigner` | ^3.775.0 | S3 presigned URLs | Current | Same as above | Keep |
| `firebase-admin` | ^13.10.0 | FCM push server SDK | Current | Only used in notification worker (unimplemented) | Keep |
| `resend` | ^6.12.4 | Transactional email | Current | Only used in notification worker (unimplemented) | Keep |
| `mammoth` | ^1.12.0 | DOCX parsing | Maintained | Unused — needed for import worker | Keep for Milestone 2 |
| `pdf-parse` | ^2.4.5 | PDF text extraction | Maintained | Unmaintained upstream (pdfjs-dist based); no known CVEs | Review before Milestone 2; consider `pdf-lib` or `pdfjs-dist` directly |
| `xlsx` | ^0.18.5 | Excel/CSV parsing | **EOL** | **Last OSS version; no security patches; formula injection risk** | **Replace with `papaparse` + `exceljs`** |
| `lucide-react` | ^1.17.0 | Icon library | Current | Version 1.x is real (post-0.x rename) | Keep |
| `class-variance-authority` | ^0.7.1 | Component variants | Current stable | — | Keep |
| `clsx` | ^2.1.1 | Class merging | Current | — | Keep |
| `tailwind-merge` | ^3.6.0 | Tailwind class dedup | Current | — | Keep |
| `motion` | ^12.40.0 | Animation library | Current | **Not used anywhere in codebase** | **Remove** |
| `react-hook-form` | ^7.77.0 | Form management | Current | **Not used anywhere in codebase** | **Remove** |
| `@hookform/resolvers` | ^5.4.0 | Zod resolver for RHF | Current | **Not used; depends on unused react-hook-form** | **Remove** |

---

### Radix UI Components

All pinned at recent stable versions. No security concerns. These are peer dependencies of shadcn/ui components.

| Package | Version | Status |
|---|---|---|
| `@radix-ui/react-avatar` | ^1.1.12 | Current |
| `@radix-ui/react-dialog` | ^1.1.16 | Current |
| `@radix-ui/react-dropdown-menu` | ^2.1.17 | Current |
| `@radix-ui/react-label` | ^2.1.9 | Current |
| `@radix-ui/react-select` | ^2.3.0 | Current |
| `@radix-ui/react-separator` | ^1.1.9 | Current |
| `@radix-ui/react-slot` | ^1.2.5 | Current |
| `@radix-ui/react-tabs` | ^1.1.14 | Current |

---

### Dev Dependencies

| Package | Version | Purpose | Status | Notes |
|---|---|---|---|---|
| `prisma` | ^6.3.0 | Schema CLI + migrations | Current | Must match `@prisma/client` | Keep |
| `typescript` | ^5 | Type checking | Current | — | Keep |
| `eslint` | ^9 | Linting | Current | — | Keep |
| `eslint-config-next` | 16.2.7 | Next.js lint rules | Matches Next.js version | — | Keep |
| `tailwindcss` | ^4 | CSS framework | Current (v4 alpha/RC) | Breaking changes from v3; verify PostCSS compat | Keep; monitor v4 stability |
| `@tailwindcss/postcss` | ^4 | PostCSS integration | Current | Required for Tailwind v4 | Keep |
| `tsx` | ^4.19.2 | TypeScript runner for scripts | Current | — | Keep |
| `vitest` | ^3.2.3 | Test runner | Current | — | Keep |
| `@types/node` | ^20 | Node.js types | Current | — | Keep |
| `@types/react` | ^19 | React types | Current | — | Keep |
| `@types/react-dom` | ^19 | React DOM types | Current | — | Keep |
| `@types/pdf-parse` | ^1.1.5 | pdf-parse types | Community types | — | Keep |

---

### Critical Dependency Risk: `xlsx` 0.18.5

**Action required before Milestone 2 (import pipeline):**

```bash
# Remove xlsx
pnpm remove xlsx

# Add maintained replacements
pnpm add papaparse exceljs
pnpm add -D @types/papaparse
```

Migration scope: only the import worker (`workers/index.ts`) and any future import route. The import worker is currently a stub, so migration cost is minimal.

---

## Flutter / Dart Dependencies

### Runtime Dependencies

| Package | Version | Purpose | Status | Notes |
|---|---|---|---|---|
| `flutter_riverpod` | ^2.6.1 | State management | Current | — |
| `riverpod_annotation` | ^2.6.1 | Code gen annotations | Current | No .g.dart files generated yet |
| `go_router` | ^14.6.2 | Navigation | Current | — |
| `dio` | ^5.7.0 | HTTP client | Current | — |
| `flutter_secure_storage` | ^9.2.2 | Encrypted storage | Current | — |
| `drift` | ^2.20.3 | SQLite ORM | Current | Declared, unused |
| `sqlite3_flutter_libs` | ^0.5.24 | SQLite native | Current | Declared, unused |
| `path_provider` | ^2.1.4 | File system paths | Current | Required by drift |
| `path` | ^1.9.0 | Path manipulation | Current | — |
| `connectivity_plus` | ^6.1.2 | Network state | Current | Declared, unused |
| `camera` | ^0.11.0 | Camera access | Current | Declared, unused |
| `image_picker` | ^1.1.2 | Photo library | Current | Declared, unused |
| `image_cropper` | ^8.0.1 | Image cropping | Current | Declared, unused |
| `google_mlkit_text_recognition` | ^0.15.0 | On-device OCR | Current | Only extractor logic implemented; no camera wiring |
| `mobile_scanner` | ^5.2.3 | QR/barcode scanner | Current | Declared, unused |
| `geolocator` | ^13.0.2 | GPS | Current | Declared, unused |
| `fl_chart` | ^0.70.2 | Charts | Current | Declared, unused |
| `share_plus` | ^10.1.3 | Native share sheet | Current | Declared, unused |
| `freezed_annotation` | ^2.4.4 | Immutable data classes | Current | No .freezed.dart generated |
| `json_annotation` | ^4.9.0 | JSON serialization | Current | No .g.dart generated |
| `intl` | ^0.19.0 | Internationalization | Current | Declared, used for date formatting in home_screen |

---

### Dev Dependencies

| Package | Version | Purpose | Status |
|---|---|---|---|
| `flutter_test` | sdk | Testing framework | Flutter SDK |
| `flutter_lints` | ^4.0.0 | Lint rules | Current |
| `build_runner` | ^2.4.13 | Code generation runner | Current |
| `freezed` | ^2.5.7 | Immutable class gen | Current |
| `json_serializable` | ^6.8.0 | JSON gen | Current |
| `riverpod_generator` | ^2.6.2 | Riverpod code gen | Current |
| `drift_dev` | ^2.20.2 | Drift schema gen | Current |

---

### Flutter Dependency Notes

1. **`google_mlkit_text_recognition` requires minSdkVersion 21** on Android — needs to be set in `android/app/build.gradle`. The Flutter app does not have an `android/` directory checked in (typical for Flutter — generated at build time), but this must be configured before the first build.

2. **`geolocator` requires location permissions** in `AndroidManifest.xml` and `Info.plist`. These need to be added before the GPS feature is used.

3. **`camera` + `mobile_scanner` may conflict** — both use the camera hardware. Only one should be active at a time. Test on physical device that switching between them does not cause a camera lock.

4. **`flutter_secure_storage` Android** — defaults to `SharedPreferences` encryption. For financial/environmental data, should use `AndroidOptions(encryptedSharedPreferences: true)` which uses Jetpack Security library instead.

---

## Upgrade Recommendations

### Immediate (security / correctness)
1. **Remove** `xlsx` 0.18.5; add `papaparse` + `exceljs`
2. **Remove** unused `motion`, `react-hook-form`, `@hookform/resolvers`

### Short Term (before production)
3. Add `flutter_secure_storage` `AndroidOptions(encryptedSharedPreferences: true)` configuration
4. Run `flutter pub upgrade --major-versions` and resolve any breaking changes

### Ongoing
5. Set up Dependabot or Renovate Bot for automated dependency updates
6. Pin `pg-boss` to a minor range (`^12.18`) to prevent unintended major version bumps
7. Monitor `tailwindcss` v4 stability — it is still in active development
