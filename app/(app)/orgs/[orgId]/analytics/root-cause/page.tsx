"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CausalAnalysisForm } from "@/components/analytics/causal-analysis-form";
import { CausalAnalysisResults } from "@/components/analytics/causal-analysis-results";
import { CausalAnalysisList } from "@/components/analytics/causal-analysis-list";

export default function RootCauseAnalysisPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAnalysisCreated = () => {
    setRefreshTrigger((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Root Cause Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Use causal inference to understand what&apos;s driving your emissions changes
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="new" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new">New Analysis</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Run Analysis</CardTitle>
                  <CardDescription>
                    Define your research question and select variables to analyze
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CausalAnalysisForm
                    orgId={orgId}
                    onAnalysisCreated={handleAnalysisCreated}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Methodology</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold mb-1">What is causal inference?</h4>
                    <p className="text-muted-foreground">
                      Causal inference techniques go beyond correlation to understand cause-and-effect
                      relationships in your emissions data.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Data used</h4>
                    <p className="text-muted-foreground">
                      Analysis runs on your approved activity records. Larger datasets produce more
                      reliable results.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Robustness score</h4>
                    <p className="text-muted-foreground">
                      Measures how resistant results are to unmeasured confounding. Higher is better.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Analyses run asynchronously. Check the Results tab to see progress.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>
                Recent causal analyses and their findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CausalAnalysisList
                orgId={orgId}
                selectedId={selectedAnalysis}
                onSelectAnalysis={setSelectedAnalysis}
                refreshTrigger={refreshTrigger}
              />
            </CardContent>
          </Card>

          {selectedAnalysis && (
            <div>
              <CausalAnalysisResults
                analysisId={selectedAnalysis}
                orgId={orgId}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
