"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudSun, Zap, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditScenarioButton, DeleteScenarioButton } from "./tcfd-actions";

interface RiskAssessment {
  id: string;
  riskCategory: string;
  likelihood: number;
  impact: number;
}

interface TcfdScenario {
  id: string;
  scenarioType: "physical" | "transition";
  name: string;
  temperaturePathway?: string | null;
  timeHorizon: string;
  description?: string | null;
  grossValueAtRiskLow?: number | null;
  grossValueAtRiskHigh?: number | null;
  riskAssessments: RiskAssessment[];
}

const TIME_HORIZON_LABEL: Record<string, string> = {
  short: "Short (0-3y)",
  medium: "Medium (3-10y)",
  long: "Long (10y+)",
};

function riskScore(likelihood: number, impact: number) {
  return likelihood * impact;
}

function riskBadge(score: number) {
  if (score >= 20) return <Badge variant="destructive">Critical</Badge>;
  if (score >= 12) return <Badge className="bg-[#c2410c] text-white">High</Badge>;
  if (score >= 6) return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}

export function TcfdTabs({
  scenarios,
  orgId,
  canEdit,
}: {
  scenarios: TcfdScenario[];
  orgId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"physical" | "transition">("physical");
  const filtered = scenarios.filter((s) => s.scenarioType === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "physical" | "transition")}>
      <TabsList>
        <TabsTrigger value="physical" className="gap-2">
          <CloudSun className="w-4 h-4" /> Physical
        </TabsTrigger>
        <TabsTrigger value="transition" className="gap-2">
          <Zap className="w-4 h-4" /> Transition
        </TabsTrigger>
      </TabsList>

      {(["physical", "transition"] as const).map((tab) => (
        <TabsContent key={tab} value={tab}>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {tab} scenarios yet</p>
              <p className="text-sm mt-1">Add a scenario to start mapping climate risks.</p>
            </div>
          ) : (
            <div className="grid gap-3 mt-3">
              {filtered.map((scenario) => {
                const maxScore = scenario.riskAssessments.reduce(
                  (m, r) => Math.max(m, riskScore(r.likelihood, r.impact)),
                  0,
                );
                return (
                  <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{scenario.name}</CardTitle>
                          <CardDescription className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{TIME_HORIZON_LABEL[scenario.timeHorizon] ?? scenario.timeHorizon}</span>
                            {scenario.temperaturePathway && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {scenario.temperaturePathway}
                              </span>
                            )}
                            {maxScore > 0 && riskBadge(maxScore)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <>
                              <EditScenarioButton orgId={orgId} scenario={scenario} />
                              <DeleteScenarioButton orgId={orgId} scenario={scenario} />
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => router.push(`/orgs/${orgId}/tcfd/${scenario.id}`)}
                          >
                            Risks <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {(scenario.description || scenario.riskAssessments.length > 0) && (
                      <CardContent className="pt-0">
                        {scenario.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{scenario.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            {scenario.riskAssessments.length} risk
                            {scenario.riskAssessments.length !== 1 ? "s" : ""} assessed
                          </span>
                          {scenario.grossValueAtRiskLow != null && (
                            <span>
                              VaR: £{scenario.grossValueAtRiskLow.toLocaleString()}
                              {scenario.grossValueAtRiskHigh != null &&
                                ` - £${scenario.grossValueAtRiskHigh.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
