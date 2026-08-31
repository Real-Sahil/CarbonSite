"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QuickBooksConnectButtonProps {
  orgId: string;
}

export function QuickBooksConnectButton({ orgId }: QuickBooksConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}/integrations/quickbooks/authorize`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to authorize QuickBooks");
        return;
      }

      window.location.href = response.url;
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
          "Connect QuickBooks"
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </>
  );
}
