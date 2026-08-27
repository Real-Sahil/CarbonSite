"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface MetricsData {
  activeSuppliersThisMonth: number;
  totalSuppliers: number;
  stalledRequests: number;
  totalRequests: number;
  approvalRate: number;
  avgResponseTimeDays: number;
  loginActivityByDate: Array<{ date: string; count: number }>;
  suppliers: Array<{
    email: string;
    name: string;
    status: string;
    loginCount7d: number;
    loginCount30d: number;
    loginCount90d: number;
    lastLoginAt?: string;
    totalAssigned: number;
    totalSubmitted: number;
    submissionRate: number;
    avgResponseTimeDays: number;
    createdAt: string;
  }>;
}

export function MetricsDashboard() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-accounts/metrics?period=${period}`);
      if (!res.ok) {
        throw new Error("Failed to load metrics");
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!metrics) return;

    const headers = [
      "Email",
      "Name",
      "Status",
      "Logins (7d)",
      "Logins (30d)",
      "Logins (90d)",
      "Last Login",
      "Total Assigned",
      "Total Submitted",
      "Submission Rate (%)",
      "Avg Response Time (Days)",
    ];

    const rows = metrics.suppliers.map((s) => [
      s.email,
      s.name,
      s.status,
      s.loginCount7d,
      s.loginCount30d,
      s.loginCount90d,
      s.lastLoginAt ? format(parseISO(s.lastLoginAt), "MMM d, yyyy") : "Never",
      s.totalAssigned,
      s.totalSubmitted,
      Math.round(s.submissionRate * 100) / 100,
      s.avgResponseTimeDays,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-metrics-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading || !metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-zinc-500">Loading metrics...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Calendar className="w-4 h-4 text-gray-600" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExportCsv} variant="outline" size="sm">
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Users className="w-4 h-4" /> Active This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{metrics.activeSuppliersThisMonth}</div>
            <p className="text-xs text-gray-500 mt-1">of {metrics.totalSuppliers} total suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Stalled Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{metrics.stalledRequests}</div>
            <p className="text-xs text-gray-500 mt-1">of {metrics.totalRequests} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{metrics.approvalRate}%</div>
            <p className="text-xs text-gray-500 mt-1">of submitted requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{metrics.avgResponseTimeDays}d</div>
            <p className="text-xs text-gray-500 mt-1">from request to submission</p>
          </CardContent>
        </Card>
      </div>

      {/* Login Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Login Activity</CardTitle>
          <CardDescription>Daily active suppliers over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.loginActivityByDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickFormatter={(value) => {
                  const date = parseISO(value);
                  return format(date, "MMM d");
                }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                }}
                formatter={(value) => `${value} suppliers`}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Breakdown</CardTitle>
          <CardDescription>Engagement and submission metrics per supplier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Supplier</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Logins (30d)</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Submissions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Rate</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Avg Response</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {metrics.suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No supplier data available
                    </td>
                  </tr>
                ) : (
                  metrics.suppliers.map((supplier) => (
                    <tr key={supplier.email} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        <div className="text-xs text-gray-500">{supplier.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{supplier.loginCount30d}</td>
                      <td className="px-4 py-3 text-center">
                        {supplier.totalSubmitted} / {supplier.totalAssigned}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            supplier.submissionRate >= 80
                              ? "bg-green-100 text-green-800"
                              : supplier.submissionRate >= 50
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {Math.round(supplier.submissionRate)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {supplier.avgResponseTimeDays.toFixed(1)}d
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {supplier.lastLoginAt
                          ? format(parseISO(supplier.lastLoginAt), "MMM d, yyyy")
                          : "Never"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
