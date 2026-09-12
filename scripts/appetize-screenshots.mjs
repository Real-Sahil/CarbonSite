#!/usr/bin/env node
/**
 * Appetize.io screenshot automation for MetricOra mobile app.
 *
 * Generates App Store and Play Store screenshots by automating the
 * screenshot-mode build (compiled with --dart-define=SCREENSHOT_MODE=true)
 * through the Appetize REST API + Playwright.
 *
 * Usage:
 *   APPETIZE_TOKEN=tok_xxx \
 *   ANDROID_APK=build/app/outputs/flutter-apk/app-release.apk \
 *   IOS_IPA=build/ios/ipa/Runner.ipa \
 *   node scripts/appetize-screenshots.mjs
 *
 * To skip upload and reuse existing app keys:
 *   ANDROID_KEY=<publicKey> IOS_KEY=<publicKey> node scripts/appetize-screenshots.mjs
 *
 * Build the screenshot-mode APK/IPA first:
 *   cd mobile
 *   flutter build apk --release --dart-define=SCREENSHOT_MODE=true
 *   flutter build ipa --release --dart-define=SCREENSHOT_MODE=true
 *
 * Output:
 *   screenshots/appstore/  - App Store required sizes (6.7", 5.5", iPad Pro 12.9")
 *   screenshots/playstore/ - Play Store sizes (phone, 7" tablet)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TOKEN = process.env.APPETIZE_TOKEN;
if (!TOKEN) {
  console.error('Error: APPETIZE_TOKEN env var is required.');
  process.exit(1);
}

const API_BASE = 'https://api.appetize.io';
// Basic auth: token as username, empty password.
const AUTH = Buffer.from(`${TOKEN}:`).toString('base64');

// App Store device targets (portrait orientation only).
const APPSTORE_TARGETS = [
  // iPhone 6.7" — required primary screenshot size
  { id: 'iphone15plus', os: 'ios', osVersion: '17', label: 'iphone-6-7in', platform: 'ios' },
  // iPhone 5.5" — second required size
  { id: 'iphone8plus', os: 'ios', osVersion: '16', label: 'iphone-5-5in', platform: 'ios' },
  // iPad Pro 12.9" — required tablet size
  { id: 'ipadpro129', os: 'ios', osVersion: '17', label: 'ipad-pro-12-9in', platform: 'ios' },
];

// Play Store device targets.
const PLAYSTORE_TARGETS = [
  // Phone screenshot (min 320dp, max 3840px long edge)
  { id: 'pixel7', os: 'android', osVersion: '13', label: 'phone', platform: 'android' },
  // 7" tablet
  { id: 'nexus7', os: 'android', osVersion: '12', label: 'tablet-7in', platform: 'android' },
];

// Screens to capture (in order). Each entry describes what to do to reach it.
const SCREENS = [
  {
    id: 'dashboard',
    name: '01-dashboard',
    description: 'Dashboard — tCO2e card + scope donut visible',
    actions: [],
    waitMs: 3500,
  },
  {
    id: 'dashboard-scrolled',
    name: '02-dashboard-chart',
    description: 'Dashboard — monthly bar chart + recent submissions',
    actions: [{ type: 'scroll', direction: 'down', distance: 400 }],
    waitMs: 800,
  },
  {
    id: 'projects',
    name: '03-projects',
    description: 'Projects tab — 3 site cards with Submit button',
    actions: [
      { type: 'tap', label: 'Projects' },
    ],
    waitMs: 1500,
  },
  {
    id: 'capture',
    name: '04-capture',
    description: 'Capture screen — document type selector grid',
    actions: [
      // Tap "Submit document" on the first project card.
      // Coordinates are approximate for a 390-wide viewport; Appetize scales.
      { type: 'tap', coords: { x: 0.5, y: 0.52 } },
    ],
    waitMs: 2000,
  },
  {
    id: 'submissions',
    name: '05-submissions',
    description: 'Submissions tab — On this device + Submitted sections',
    actions: [
      { type: 'key', key: 'escape' },
      { type: 'tap', label: 'Submissions' },
    ],
    waitMs: 1500,
  },
];

// ---------------------------------------------------------------------------
// Upload helpers (Appetize REST API v1)
// ---------------------------------------------------------------------------

async function uploadBuild(filePath, platform) {
  console.log(`Uploading ${platform} build: ${filePath} ...`);

  const bytes = readFileSync(filePath);
  const blob = new Blob([bytes]);
  const form = new FormData();
  form.append('file', blob, platform === 'ios' ? 'app.ipa' : 'app.apk');
  form.append('platform', platform);

  const res = await fetch(`${API_BASE}/v1/apps`, {
    method: 'POST',
    headers: { Authorization: `Basic ${AUTH}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`  publicKey: ${data.publicKey}`);
  return data.publicKey;
}

// ---------------------------------------------------------------------------
// Session control via Appetize JS (Playwright-embedded)
// ---------------------------------------------------------------------------

/**
 * Opens the Appetize web player in a Playwright browser page, waits for the
 * app session to become ready, then executes the provided action sequence and
 * returns a Buffer of the screenshot PNG.
 */
async function captureScreen(publicKey, device, screen, outPath) {
  const { label: deviceLabel, osVersion, os } = device;
  const embedUrl =
    `https://appetize.io/embed/${publicKey}` +
    `?device=${device.id}` +
    `&osVersion=${osVersion}` +
    `&scale=auto` +
    `&autoplay=true` +
    `&orientation=portrait` +
    `&deviceColor=black` +
    `&xdocMsg=true` +
    `&screenOnly=true`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 480, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(embedUrl, { waitUntil: 'networkidle' });

    // The Appetize iframe exposes its session via the xdocMsg postMessage API.
    // Wait until the app reports "sessionRequested" or "appLaunch" status.
    await page.waitForFunction(() => {
      return document.querySelector('iframe') !== null;
    }, { timeout: 15000 });

    const frame = page.frameLocator('iframe').first();

    // Wait for app to load — screenshot mode boots directly to dashboard
    // so the tCO2e card should appear quickly.
    await page.waitForTimeout(screen.waitMs ?? 3000);

    // Execute actions.
    for (const action of (screen.actions ?? [])) {
      if (action.type === 'tap' && action.label) {
        // Try to find an element by accessibility label text inside the frame.
        try {
          const el = frame.getByText(action.label, { exact: true }).first();
          await el.click({ timeout: 5000 });
        } catch {
          console.warn(`    Warning: could not tap "${action.label}" by label.`);
        }
        await page.waitForTimeout(800);
      } else if (action.type === 'tap' && action.coords) {
        // Fractional viewport coordinates → pixel tap inside the iframe.
        const iframeEl = page.locator('iframe').first();
        const box = await iframeEl.boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width * action.coords.x,
            box.y + box.height * action.coords.y,
          );
        }
        await page.waitForTimeout(800);
      } else if (action.type === 'scroll' && action.direction === 'down') {
        const iframeEl = page.locator('iframe').first();
        const box = await iframeEl.boundingBox();
        if (box) {
          await page.mouse.move(
            box.x + box.width * 0.5,
            box.y + box.height * 0.5,
          );
          await page.mouse.wheel(0, action.distance ?? 300);
        }
        await page.waitForTimeout(600);
      } else if (action.type === 'key') {
        await page.keyboard.press(action.key);
        await page.waitForTimeout(400);
      }
    }

    // Final settle wait before screenshot.
    await page.waitForTimeout(500);

    // Capture just the iframe region (the device screen).
    const iframeEl = page.locator('iframe').first();
    const buf = await iframeEl.screenshot({ type: 'png' });
    writeFileSync(outPath, buf);
    console.log(`    Saved: ${outPath}`);
    return true;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Resolve app public keys — upload if build files given, else use env keys.
  let androidKey = process.env.ANDROID_KEY;
  let iosKey = process.env.IOS_KEY;

  const androidApk = process.env.ANDROID_APK;
  const iosIpa = process.env.IOS_IPA;

  if (!androidKey && androidApk && existsSync(androidApk)) {
    androidKey = await uploadBuild(androidApk, 'android');
  }
  if (!iosKey && iosIpa && existsSync(iosIpa)) {
    iosKey = await uploadBuild(iosIpa, 'ios');
  }

  if (!androidKey && !iosKey) {
    console.error(
      'Error: no app keys available.\n' +
      'Set ANDROID_KEY/IOS_KEY or point ANDROID_APK/IOS_IPA at build files.',
    );
    process.exit(1);
  }

  // Create output directories.
  mkdirSync(join(ROOT, 'screenshots', 'appstore'), { recursive: true });
  mkdirSync(join(ROOT, 'screenshots', 'playstore'), { recursive: true });

  // App Store screenshots (iOS only).
  if (iosKey) {
    console.log('\n== App Store screenshots ==');
    for (const device of APPSTORE_TARGETS) {
      console.log(`\n  Device: ${device.id} (${device.label})`);
      for (const screen of SCREENS) {
        const outPath = join(
          ROOT, 'screenshots', 'appstore',
          `${device.label}-${screen.name}.png`,
        );
        try {
          await captureScreen(iosKey, device, screen, outPath);
        } catch (err) {
          console.warn(`    Error capturing ${screen.id}: ${err.message}`);
        }
      }
    }
  }

  // Play Store screenshots (Android only).
  if (androidKey) {
    console.log('\n== Play Store screenshots ==');
    for (const device of PLAYSTORE_TARGETS) {
      console.log(`\n  Device: ${device.id} (${device.label})`);
      for (const screen of SCREENS) {
        const outPath = join(
          ROOT, 'screenshots', 'playstore',
          `${device.label}-${screen.name}.png`,
        );
        try {
          await captureScreen(androidKey, device, screen, outPath);
        } catch (err) {
          console.warn(`    Error capturing ${screen.id}: ${err.message}`);
        }
      }
    }
  }

  console.log('\nDone. Screenshots written to screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
