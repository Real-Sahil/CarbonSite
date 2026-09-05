"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QuickBooksConnectButtonProps {
  orgId: string;
  connected?: boolean;
}

export function QuickBooksConnectButton({ orgId, connected = false }: QuickBooksConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}/integrations/quickbooks`, { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "Failed to authorize QuickBooks");
        setIsLoading(false);
        return;
      }

      window.location.href = json.authUrl;
    } catch (err) {
      console.error("QuickBooks connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isLoading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          connected ? "Reconnect QuickBooks" : "Connect QuickBooks"
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </>
  );
}
