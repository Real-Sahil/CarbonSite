/**
 * In-memory pub/sub manager for real-time dashboard updates.
 * Broadcasts calculation completion events to all connected clients.
 */

export interface DashboardUpdate {
  timestamp: Date;
  orgId: string;
  aggregates: {
    totalCo2e: number;
    scope1: number;
    scope2: number;
    scope3: number;
    byCategory: Record<string, number>;
  };
  calculationRunId: string;
}

type SubscriptionCallback = (update: DashboardUpdate) => void;

interface Subscription {
  orgId: string;
  callback: SubscriptionCallback;
}

class SubscriptionManager {
  private subscriptions: Map<string, Subscription[]> = new Map();

  /**
   * Subscribe to dashboard updates for an organization.
   * Returns unsubscribe function.
   */
  public subscribe(orgId: string, callback: SubscriptionCallback): () => void {
    if (!this.subscriptions.has(orgId)) {
      this.subscriptions.set(orgId, []);
    }

    const subscription: Subscription = { orgId, callback };
    const subs = this.subscriptions.get(orgId)!;
    subs.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = subs.indexOf(subscription);
      if (index > -1) {
        subs.splice(index, 1);
      }
      // Clean up empty org subscriptions
      if (subs.length === 0) {
        this.subscriptions.delete(orgId);
      }
    };
  }

  /**
   * Broadcast update to all subscribers of an organization.
   */
  public broadcast(update: DashboardUpdate): void {
    const subs = this.subscriptions.get(update.orgId);
    if (!subs) return;

    for (const sub of subs) {
      try {
        sub.callback(update);
      } catch (err) {
        console.error(`Error calling subscription callback: ${err}`);
      }
    }
  }

  /**
   * Get active subscription count for an org.
   */
  public getSubscriptionCount(orgId: string): number {
    return this.subscriptions.get(orgId)?.length ?? 0;
  }

  /**
   * Clear all subscriptions (useful for testing).
   */
  public clear(): void {
    this.subscriptions.clear();
  }
}

// Singleton instance
export const subscriptionManager = new SubscriptionManager();
