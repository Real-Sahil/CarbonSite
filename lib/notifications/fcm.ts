// Firebase Cloud Messaging helper — server-side push notifications.
// Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string of service account).
// In dev/test, set PUSH_DRIVER=disabled to suppress sends without error.

import { prisma } from "@/lib/db";

let _messaging: import("firebase-admin/messaging").Messaging | null = null;

function getMessaging() {
  if (_messaging) return _messaging;

  if (process.env.PUSH_DRIVER === "disabled" || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin") as typeof import("firebase-admin");
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    _messaging = admin.messaging();
    return _messaging;
  } catch (err) {
    console.warn("[fcm] Failed to initialise Firebase Admin — push disabled:", err);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends a push notification to all device tokens registered for a user.
 * Silently ignores users with no registered tokens.
 * Removes tokens that FCM reports as invalid/unregistered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) return;

  const tokenStrings = tokens.map((t) => t.token);
  const response = await messaging.sendEachForMulticast({
    tokens: tokenStrings,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    android: { priority: "high" },
    apns: {
      payload: {
        aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      },
    },
  });

  // Remove stale tokens reported as invalid by FCM.
  const staleIds: string[] = [];
  response.responses.forEach((res: import("firebase-admin/messaging").SendResponse, index: number) => {
    if (!res.success && (
      res.error?.code === "messaging/registration-token-not-registered" ||
      res.error?.code === "messaging/invalid-registration-token"
    )) {
      const tokenRow = tokens[index];
      if (tokenRow) staleIds.push(tokenRow.id);
    }
  });

  if (staleIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: staleIds } } });
  }
}
