'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

export default function MonitoringSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoring & Alerts</h1>
        <p className="text-gray-600 mt-2">
          Real-time operational dashboards and alerting via Grafana Cloud
        </p>
      </div>

      {/* Setup Status */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Grafana Cloud monitoring is optional and configured at the organization level. Free tier includes 3 dashboards and 3 users.{' '}
          <a
            href="https://grafana.com/auth/sign-up/create-account"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline hover:text-blue-900"
          >
            Create free account
          </a>
        </AlertDescription>
      </Alert>

      {/* Monitoring Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Report Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Real-time</div>
            <p className="text-xs text-gray-500 mt-1">5 metrics tracked</p>
            <Badge className="mt-3 bg-green-100 text-green-800">Active</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Real-time</div>
            <p className="text-xs text-gray-500 mt-1">6 quality checks</p>
            <Badge className="mt-3 bg-green-100 text-green-800">Active</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Field Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Real-time</div>
            <p className="text-xs text-gray-500 mt-1">5 metrics tracked</p>
            <Badge className="mt-3 bg-green-100 text-green-800">Active</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Grafana Dashboards */}
      <Card>
        <CardHeader>
          <CardTitle>Grafana Cloud Dashboards</CardTitle>
          <CardDescription>
            Connect your PostgreSQL database to Grafana Cloud for real-time monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              {
                title: 'Report Generation Pipeline',
                description: 'Monitor report creation, generation time, and delivery status',
                icon: '📊',
              },
              {
                title: 'Data Quality & Validation',
                description: 'Track import quality scores and validation check results',
                icon: '✓',
              },
              {
                title: 'Field Submissions Pipeline',
                description: 'Monitor field worker submissions and approval workflow',
                icon: '📝',
              },
            ].map((dashboard) => (
              <div
                key={dashboard.title}
                className="flex items-start justify-between p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-1">{dashboard.icon}</div>
                  <div>
                    <h4 className="font-semibold text-sm">{dashboard.title}</h4>
                    <p className="text-xs text-gray-600">{dashboard.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="default"
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="w-full"
            >
              {showSetupGuide ? 'Hide Setup Guide' : 'Setup Grafana Cloud'}
            </Button>

            {showSetupGuide && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-3">Setup Instructions:</h4>
                <ol className="text-xs space-y-2 text-gray-700 list-decimal list-inside">
                  <li>Create a free Grafana Cloud account at grafana.com</li>
                  <li>Add PostgreSQL data source pointing to your database</li>
                  <li>Import the 3 dashboards using the SQL queries in our guide</li>
                  <li>Configure Slack alerts for your team</li>
                  <li>Share dashboard links with team members</li>
                </ol>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href="https://grafana.com/auth/sign-up/create-account"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Create Grafana Account
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href="/docs/monitoring/grafana-setup.md" target="_blank" rel="noopener noreferrer">
                      Full Setup Guide
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Configuration</CardTitle>
          <CardDescription>Set up automated alerts for your team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              {
                name: 'High Report Failure Rate',
                description: 'Alert when > 5 reports fail in 24 hours',
                status: 'enabled',
              },
              {
                name: 'Data Quality Below Threshold',
                description: 'Alert when average quality score < 80%',
                status: 'enabled',
              },
              {
                name: 'Submission Review Backlog',
                description: 'Alert when > 20 submissions pending review',
                status: 'enabled',
              },
            ].map((alert) => (
              <div
                key={alert.name}
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div>
                  <h4 className="font-semibold text-sm">{alert.name}</h4>
                  <p className="text-xs text-gray-600">{alert.description}</p>
                </div>
                <Badge
                  className={
                    alert.status === 'enabled'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {alert.status === 'enabled' ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Alerts are configured in Grafana Cloud. To modify alert thresholds or channels, log into your Grafana organization and edit the alert rules.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
          <CardDescription>Learn more about monitoring and operational dashboards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              asChild
            >
              <a href="/docs/monitoring/grafana-setup.md" target="_blank" rel="noopener noreferrer">
                Grafana Cloud Setup Guide
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              asChild
            >
              <a href="https://grafana.com/docs" target="_blank" rel="noopener noreferrer">
                Grafana Documentation
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
