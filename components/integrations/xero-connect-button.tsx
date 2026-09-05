"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface XeroConnectButtonProps {
  orgId: string;
}

export function XeroConnectButton({ orgId }: XeroConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}/integrations/xero/authorize`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to authorize Xero");
        return;
      }

      // Authorization endpoint redirects, so we follow the redirect
      window.location.href = response.url;
    } catch (err) {
      console.error("Xero connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isLoading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          "Connect Xero"
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </>
  );
}
