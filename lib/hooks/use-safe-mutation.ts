"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleSupabaseError } from "@/lib/utils/supabase-error-handler";

/**
 * Hook for safely handling mutations (POST/PATCH/DELETE) without throwing errors to the error boundary.
 * All errors are caught and converted to user-facing messages.
 *
 * @example
 * const { execute, error, isPending } = useSafeMutation();
 *
 * const handleApprove = async () => {
 *   const result = await execute(async () => {
 *     const res = await fetch(`/api/...`, { method: 'PATCH' });
 *     if (!res.ok) throw new Error((await res.json()).message);
 *     return res.json();
 *   });
 *   if (result.success) router.refresh();
 * };
 */
export function useSafeMutation<T = any>() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: string }> => {
      setError(null);
      setIsPending(true);
      try {
        const data = await fn();
        return { success: true, data };
      } catch (err) {
        const { action, message } = handleSupabaseError(err);

        if (action === "logout") {
          // Clear auth state and redirect
          try {
            localStorage.removeItem("session");
          } catch {}
          router.push("/auth/sign-in");
          return { success: false, error: message };
        }

        // For show_error and retry actions, just set the error message
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsPending(false);
      }
    },
    [router]
  );

  return { execute, error, isPending, setError };
}
