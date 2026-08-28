// In-memory pub/sub for real-time dashboard updates
// Broadcasts calculation completions to connected SSE clients

interface SubscriberCallback {
  (data: DashboardUpdate): void;
}

export interface DashboardUpdate {
  type: "calculation_progress" | "snapshot_published" | "report_ready" | "error";
  organizationId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Map of organizationId -> Set of subscriber callbacks
const subscribers = new Map<string, Set<SubscriberCallback>>();

/**
 * Subscribe to real-time dashboard updates for an organization
 * Returns unsubscribe function
 */
export function subscribeToDashboardUpdates(
  organizationId: string,
  callback: SubscriberCallback
): () => void {
  if (!subscribers.has(organizationId)) {
    subscribers.set(organizationId, new Set());
  }

  const orgSubscribers = subscribers.get(organizationId)!;
  orgSubscribers.add(callback);

  // Return unsubscribe function
  return () => {
    orgSubscribers.delete(callback);
    if (orgSubscribers.size === 0) {
      subscribers.delete(organizationId);
    }
  };
}

/**
 * Broadcast a dashboard update to all subscribers for an organization
 */
export function broadcastDashboardUpdate(update: DashboardUpdate): void {
  const orgSubscribers = subscribers.get(update.organizationId);

  if (!orgSubscribers) {
    return;
  }

  // Send update to all subscribers
  orgSubscribers.forEach((callback) => {
    try {
      callback(update);
    } catch (error) {
      console.error("Error calling dashboard subscriber:", error);
    }
  });
}

/**
 * Get subscriber count for an organization (for monitoring)
 */
export function getSubscriberCount(organizationId: string): number {
  return subscribers.get(organizationId)?.size || 0;
}

/**
 * Get total active subscriptions across all orgs
 */
export function getTotalSubscriptions(): number {
  let total = 0;
  subscribers.forEach((subs) => {
    total += subs.size;
  });
  return total;
}

/**
 * Clear all subscriptions (for testing/cleanup)
 */
export function clearAllSubscriptions(): void {
  subscribers.clear();
}
