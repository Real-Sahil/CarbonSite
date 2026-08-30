"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface CausalAnalysis {
  id: string;
  question: string;
  treatment: string;
  outcome: string;
  status: "queued" | "running" | "completed" | "failed";
  treatmentEffect?: number;
  pValue?: number;
  createdAt: string;
}

interface CausalAnalysisListProps {
  orgId: string;
  selectedId?: string | null;
  onSelectAnalysis: (id: string) => void;
  refreshTrigger?: number;
}

const statusBadgeMap: Record<string, string> = {
  queued: "bg-gray-100 text-gray-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function CausalAnalysisList({
  orgId,
  selectedId,
  onSelectAnalysis,
  refreshTrigger,
}: CausalAnalysisListProps) {
  const [analyses, setAnalyses] = useState<CausalAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = useCallback(async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/causal-analyses`);
      if (!response.ok) throw new Error("Failed to load analyses");

      const data = await response.json();
      setAnalyses(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAnalyses();
    const interval = setInterval(loadAnalyses, 5000);
    return () => clearInterval(interval);
  }, [loadAnalyses, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>;
  }

  if (analyses.length === 0) {
    return <div className="text-muted-foreground text-sm">No analyses yet</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Question</TableHead>
            <TableHead>Variables</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Effect Size</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analyses.map((analysis) => (
            <TableRow
              key={analysis.id}
              className={`cursor-pointer hover:bg-muted/50 ${
                selectedId === analysis.id ? "bg-muted" : ""
              }`}
            >
              <TableCell className="max-w-xs truncate">
                <div className="font-medium text-sm">{analysis.question}</div>
              </TableCell>
              <TableCell className="text-sm">
                <div className="text-muted-foreground">
                  {analysis.treatment} → {analysis.outcome}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusBadgeMap[analysis.status]}>
                  {analysis.status === "running" && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  {analysis.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {analysis.status === "completed" && analysis.treatmentEffect !== undefined ? (
                  <div>
                    <div className="font-medium">{analysis.treatmentEffect?.toFixed(2)}</div>
                    {analysis.pValue !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        p={analysis.pValue?.toFixed(4)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(analysis.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectAnalysis(analysis.id)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
