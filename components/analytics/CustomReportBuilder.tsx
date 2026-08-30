'use client';

import React, { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportFormData {
  title: string;
  description?: string;
  periodIds: string[];
  scopes?: number[];
  categoryIds?: string[];
  facilityIds?: string[];
  format: 'csv' | 'json' | 'pdf';
  includeCharts: boolean;
  includeSummary: boolean;
  includeRecommendations: boolean;
}

interface CustomReportBuilderProps {
  orgId: string;
  onReportGenerated?: (url: string, format: string) => void;
}

export function CustomReportBuilder({
  orgId,
  onReportGenerated,
}: CustomReportBuilderProps) {
  const [formData, setFormData] = useState<ReportFormData>({
    title: 'Emissions Report',
    format: 'pdf',
    includeCharts: true,
    includeSummary: true,
    includeRecommendations: true,
    periodIds: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available periods
  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ['reporting-periods', orgId],
    queryFn: async () => {
      const response = await fetch(`/api/orgs/${orgId}/reporting-periods`);
      if (!response.ok) throw new Error('Failed to fetch periods');
      return response.json();
    },
  });

  // Generate report mutation
  const { mutate: generateReport, isPending } = useMutation({
    mutationFn: async () => {
      if (!formData.periodIds.length) {
        setErrors({ periodIds: 'At least one period is required' });
        return;
      }

      const response = await fetch(
        `/api/orgs/${orgId}/analytics/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      // Handle different response types
      if (formData.format === 'csv') {
        const blob = await response.blob();
        return {
          blob,
          filename: `${formData.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`,
        };
      } else if (formData.format === 'pdf') {
        const blob = await response.blob();
        return {
          blob,
          filename: `${formData.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        };
      } else {
        // JSON
        const data = await response.json();
        return { data, filename: `${formData.title}.json` };
      }
    },
    onSuccess: (result: any) => {
      if (result.blob) {
        // Download file
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onReportGenerated?.(url, formData.format);
      }
      setErrors({});
    },
    onError: (error) => {
      setErrors({
        submit: error instanceof Error ? error.message : 'Report generation failed',
      });
    },
  });

  const togglePeriod = (periodId: string) => {
    setFormData(prev => ({
      ...prev,
      periodIds: prev.periodIds.includes(periodId)
        ? prev.periodIds.filter(p => p !== periodId)
        : [...prev.periodIds, periodId],
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Build Custom Report
          </CardTitle>
          <CardDescription>
            Generate emissions reports with customizable dimensions and export formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Metadata */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">
                Report Title
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., 2024 Q4 Emissions Report"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add context or notes about this report"
                className="mt-1"
              />
            </div>
          </div>

          {/* Period Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Reporting Periods *
            </Label>
            {periodsLoading ? (
              <div className="text-sm text-gray-600">Loading periods...</div>
            ) : periods?.length ? (
              <div className="space-y-2">
                {periods.map((period: any) => (
                  <div key={period.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`period-${period.id}`}
                      checked={formData.periodIds.includes(period.id)}
                      onCheckedChange={() => togglePeriod(period.id)}
                    />
                    <Label
                      htmlFor={`period-${period.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {period.label}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No reporting periods available</p>
            )}
            {errors.periodIds && (
              <p className="text-xs text-red-600 mt-2">{errors.periodIds}</p>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <Label htmlFor="format" className="text-sm font-medium">
              Export Format
            </Label>
            <Select value={formData.format} onValueChange={value =>
              setFormData(prev => ({ ...prev, format: value as 'csv' | 'json' | 'pdf' }))
            }>
              <SelectTrigger id="format" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                <SelectItem value="json">JSON Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content Options */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">Report Contents</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="summary"
                  checked={formData.includeSummary}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, includeSummary: Boolean(checked) }))
                  }
                />
                <Label htmlFor="summary" className="text-sm font-normal cursor-pointer">
                  Summary Statistics
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="charts"
                  checked={formData.includeCharts}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, includeCharts: Boolean(checked) }))
                  }
                />
                <Label htmlFor="charts" className="text-sm font-normal cursor-pointer">
                  Charts & Visualizations
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recommendations"
                  checked={formData.includeRecommendations}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, includeRecommendations: Boolean(checked) }))
                  }
                />
                <Label htmlFor="recommendations" className="text-sm font-normal cursor-pointer">
                  Recommendations
                </Label>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {errors.submit && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  title: 'Emissions Report',
                  format: 'pdf',
                  includeCharts: true,
                  includeSummary: true,
                  includeRecommendations: true,
                  periodIds: [],
                });
                setErrors({});
              }}
              disabled={isPending}
            >
              Reset
            </Button>
            <Button
              onClick={() => generateReport()}
              disabled={isPending || !formData.periodIds.length}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Report Tips</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Select multiple periods to compare trends over time</li>
            <li>• PDF reports include formatted charts and are best for sharing</li>
            <li>• CSV is ideal for data analysis in spreadsheet software</li>
            <li>• JSON format preserves all data details for integration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
