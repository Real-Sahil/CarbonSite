# GitHub Actions Remediation Plan
## Fluid Enterprise Platform

**Date:** 2026-06-13  
**Branch:** `claude/claude-md-docs-Vlp8G`  
**Audit scope:** All 4 workflow files in `.github/workflows/`

---

## Workflow Inventory

| File | Lines | Trigger | Status |
|---|---|---|---|
| `ci.yml` | 80 | push:main + all PRs | Active — passes after recent fix |
| `mobile-build.yml` | 113 | Tags `v*`/`mobile-v*` + manual dispatch | Active |
| `production-db.yml` | 46 | Manual dispatch only | Active |
| `neon_workflow.yml` | 95 | PR opened/reopened/sync/closed | Active |

---

## CI Workflow (`ci.yml`)

### Current state (post-fix, verified passing)

```yaml
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
        env: [DATABASE_URL, STORAGE_*, BETTER_AUTH_*, EMAIL_*, TRUSTED_ORIGINS]

  android:
    runs-on: ubuntu-latest
    if: hashFiles('mobile/pubspec.yaml') != ''
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17" }
      - uses: subosito/flutter-action@v2
        with: { flutter-version: "3.x", channel: stable, cache: true }
      - run: flutter pub get           (working-directory: mobile)
      - run: dart run build_runner build --delete-conflicting-outputs
      - run: flutter analyze --no-fatal-infos
      - run: flutter build apk --release
      - uses: actions/upload-artifact@v4
```

### Issues Identified and Fixed

#### FIXED-01: Missing JDK 17 (was causing Android build failure)
**Problem:** AGP 9.0.1 requires JDK 17 minimum. CI was using the runner default (JDK 21 or JDK 11 depending on runner image version).  
**Fix applied:** Added `actions/setup-java@v4` with `distribution: temurin, java-version: "17"`.

#### FIXED-02: Missing `build_runner` code generation step
**Problem:** `drift` requires `dart run build_runner build` to generate `*.g.dart` files. Without it, `flutter build apk` fails with "undefined class" errors on generated drift DB classes.  
**Fix applied:** Added `dart run build_runner build --delete-conflicting-outputs` before analyze/build.

#### FIXED-03: `minSdk` too low (21 vs required 23)
**Problem:** `google_mlkit_text_recognition` and `flutter_secure_storage` both require `minSdk >= 23`. The old `minSdk = flutter.minSdkVersion` resolved to 21.  
**File:** `mobile/android/app/build.gradle.kts`  
**Fix applied:** Changed to `minSdk = 23` (hardcoded).

#### FIXED-04: Gradle JVM OOM (`-Xmx8G` on 7 GB CI runner)
**Problem:** `gradle.properties` set `-Xmx8G` — larger than the GitHub Actions ubuntu-latest runner's available memory (7 GB).  
**File:** `mobile/android/gradle.properties`  
**Fix applied:** Reduced to `-Xmx4G -XX:MaxMetaspaceSize=2G -XX:ReservedCodeCacheSize=512m`.

#### FIXED-05: Removed deprecated AGP 9.0 properties
**Problem:** `android.newDsl=false` and `android.builtInKotlin=false` were removed in AGP 9.0 and caused build warnings that promoted to errors with `--warning-mode all`.  
**Fix applied:** Removed both properties from `gradle.properties`.

#### FIXED-06: Missing `UCropActivity` in AndroidManifest
**Problem:** `image_cropper` plugin requires `com.yalantis.ucrop.UCropActivity` declared in the manifest. Without it, the cropper Activity crashes at runtime (not caught by CI).  
**File:** `mobile/android/app/src/main/AndroidManifest.xml`  
**Fix applied:** Added the `UCropActivity` declaration.

#### FIXED-07: Missing ML Kit OCR manifest metadata
**Problem:** `google_mlkit_text_recognition` requires `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr"/>` to bundle the OCR model on-device at install time. Without it, the model downloads lazily on first use (may fail on cold devices/CI).  
**Fix applied:** Added the `meta-data` tag to `AndroidManifest.xml`.

---

## Remaining Issues (Not Yet Fixed)

### ISSUE-01: No Content Security Policy header
**Severity:** High — P0 security  
**Location:** `next.config.ts`, `middleware.ts`  
**Problem:** Both files apply multiple security headers but omit `Content-Security-Policy`. Without CSP, XSS payloads can exfiltrate session tokens.

**Fix:**
```typescript
// next.config.ts — add to headers() array
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // required for Next.js inline scripts
    "style-src 'self' 'unsafe-inline'",   // required for Tailwind inline styles
    "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com",
    "connect-src 'self' https://*.r2.cloudflarestorage.com",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
}
```

### ISSUE-02: No security scanning in CI
**Severity:** High  
**Location:** `.github/workflows/ci.yml`  
**Problem:** No SAST, dependency review, or secret scanning.

**Fix — add to `ci.yml`:**
```yaml
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        if: github.event_name == 'pull_request'
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### ISSUE-03: No integration test step
**Severity:** High  
**Location:** `.github/workflows/ci.yml`  
**Problem:** `pnpm test` only runs unit tests (Vitest). No end-to-end pipeline test (import → commit → calculate → snapshot → report).

**Fix:** Add `JOB_PROCESSING_MODE=inline` integration test with a test Postgres database:
```yaml
  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: metricora_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/metricora_test
      - run: pnpm prisma db seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/metricora_test
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/metricora_test
          JOB_PROCESSING_MODE: inline
          STORAGE_DRIVER: local
          BETTER_AUTH_SECRET: test-secret-32-chars-minimum-padding
          BETTER_AUTH_URL: http://localhost:3000
```

Add to `package.json`:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### ISSUE-04: Worker process not tested in CI
**Severity:** Medium  
**Location:** `workers/index.ts`  
**Problem:** The pg-boss worker process is never exercised in CI. A regression in any job handler (imports, calculations, reports, notifications) would only be caught in production.

**Fix:** Use `JOB_PROCESSING_MODE=inline` in integration tests so that `dispatchImport()`, `dispatchCalculation()`, etc. execute the worker function directly without needing the separate worker process.

**Current dispatch logic (`lib/jobs/dispatch.ts:L1-56`):**
```typescript
if (process.env.JOB_PROCESSING_MODE === "inline") {
  await processImportBatch(data.importBatchId, data.orgId);
} else {
  await boss.send("imports", data);
}
```
This is already in place — just needs the integration test to set `JOB_PROCESSING_MODE=inline`.

### ISSUE-05: Puppeteer not cached in CI
**Severity:** Low — slow builds  
**Location:** `.github/workflows/ci.yml`  
**Problem:** `puppeteer@25.1.0` downloads headless Chromium (~130 MB) on every CI run. This adds ~60 seconds to the web build job.

**Fix:**
```yaml
- name: Cache Puppeteer
  uses: actions/cache@v4
  with:
    path: ~/.cache/puppeteer
    key: puppeteer-${{ runner.os }}-${{ hashFiles('package.json') }}
    restore-keys: |
      puppeteer-${{ runner.os }}-
```

### ISSUE-06: Flutter version floating (`3.x`) in CI
**Severity:** Medium  
**Location:** `.github/workflows/ci.yml` — `subosito/flutter-action@v2` with `flutter-version: "3.x"`  
**Problem:** `3.x` resolves to the latest stable Flutter 3 release. If Flutter ships a breaking 3.x release, CI will silently start using the new version — potentially breaking builds without a clear cause.

**Fix:** Pin to the same version used in `mobile-build.yml`:
```yaml
- uses: subosito/flutter-action@v2
  with:
    flutter-version: "3.44.0"  # match mobile-build.yml
    channel: stable
    cache: true
```

### ISSUE-07: iOS build unsigned only
**Severity:** Medium — cannot ship to App Store  
**Location:** `.github/workflows/mobile-build.yml`  
**Problem:** iOS build uses `--no-codesign`. The artifact is a zipped `.app` that cannot be uploaded to TestFlight or App Store Connect.

**Fix:** Add Fastlane + Apple certificates to GitHub Secrets for a code-signed IPA:
```yaml
  ios-signed:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: "3.44.0", channel: stable }
      - name: Import signing certificates
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.IOS_P12_BASE64 }}
          p12-password: ${{ secrets.IOS_P12_PASSWORD }}
      - name: Install provisioning profile
        uses: apple-actions/download-provisioning-profiles@v1
        with:
          bundle-id: app.metricora.metricora_mobile
          issuer-id: ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id: ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
      - run: flutter build ipa --release
        working-directory: mobile
      - name: Upload to TestFlight
        uses: apple-actions/upload-testflight-build@v1
        with:
          app-path: mobile/build/ios/ipa/metricora_mobile.ipa
          issuer-id: ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id: ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
```

### ISSUE-08: Neon workflow uses branch name directly (injection risk)
**Severity:** Low — theoretical  
**Location:** `.github/workflows/neon_workflow.yml`  
**Problem:** Branch names are used to construct the Neon branch label. A branch name with special characters could cause issues with the Neon API call.

**Fix:** Sanitise the branch name:
```yaml
- name: Sanitise branch name
  id: branch
  run: |
    SAFE=$(echo "${{ github.head_ref }}" | tr '/' '-' | tr '_' '-' | cut -c1-50)
    echo "name=$SAFE" >> $GITHUB_OUTPUT
```

---

## Remediation Priority Table

| ID | Issue | Severity | Effort | Status |
|---|---|---|---|---|
| FIXED-01 | Missing JDK 17 | Critical | Done | ✅ Fixed |
| FIXED-02 | Missing build_runner step | Critical | Done | ✅ Fixed |
| FIXED-03 | minSdk too low | Critical | Done | ✅ Fixed |
| FIXED-04 | Gradle JVM OOM | High | Done | ✅ Fixed |
| FIXED-05 | Removed deprecated AGP props | Medium | Done | ✅ Fixed |
| FIXED-06 | Missing UCropActivity manifest | Medium | Done | ✅ Fixed |
| FIXED-07 | Missing ML Kit OCR metadata | Medium | Done | ✅ Fixed |
| ISSUE-01 | No Content Security Policy | High | 1d | ⚠️ Pending |
| ISSUE-02 | No security scanning (CodeQL) | High | 0.5d | ⚠️ Pending |
| ISSUE-03 | No integration tests in CI | High | 5d | ⚠️ Pending |
| ISSUE-04 | Worker not tested in CI | Medium | 1d | ⚠️ Pending |
| ISSUE-05 | Puppeteer not cached | Low | 0.5d | ⚠️ Pending |
| ISSUE-06 | Flutter version floating | Medium | 0.5d | ⚠️ Pending |
| ISSUE-07 | iOS build unsigned | Medium | 3d | ⚠️ Pending |
| ISSUE-08 | Branch name injection | Low | 0.5d | ⚠️ Pending |

---

## Complete Fixed `ci.yml` (Recommended Target State)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  web:
    name: Web — lint / typecheck / test / build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Cache Puppeteer
        uses: actions/cache@v4
        with:
          path: ~/.cache/puppeteer
          key: puppeteer-${{ runner.os }}-${{ hashFiles('package.json') }}
          restore-keys: puppeteer-${{ runner.os }}-
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
        env:
          DATABASE_URL: postgresql://user:password@localhost:5432/metricora
          STORAGE_DRIVER: local
          STORAGE_ENDPOINT: https://example.r2.cloudflarestorage.com
          STORAGE_ACCESS_KEY_ID: placeholder
          STORAGE_SECRET_ACCESS_KEY: placeholder
          STORAGE_BUCKET: metricora
          BETTER_AUTH_SECRET: placeholder-secret-32-chars-minimum!!
          BETTER_AUTH_URL: http://localhost:3000
          EMAIL_DRIVER: console
          TRUSTED_ORIGINS: http://localhost:3000

  android:
    name: Android — release APK
    runs-on: ubuntu-latest
    if: hashFiles('mobile/pubspec.yaml') != ''
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: "3.44.0"    # pinned — match mobile-build.yml
          channel: stable
          cache: true

      - name: Install dependencies
        working-directory: mobile
        run: flutter pub get

      - name: Generate code (drift)
        working-directory: mobile
        run: dart run build_runner build --delete-conflicting-outputs

      - name: Analyze
        working-directory: mobile
        run: flutter analyze --no-fatal-infos

      - name: Build release APK (debug-signed for CI)
        working-directory: mobile
        run: flutter build apk --release

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: fluid-release-${{ github.sha }}
          path: mobile/build/app/outputs/flutter-apk/app-release.apk
          retention-days: 14

  security:
    name: Security — CodeQL + dependency review
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        if: github.event_name == 'pull_request'
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

---

*End of GitHub Actions Remediation*  
*Date: 2026-06-13*
