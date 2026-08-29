'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Database, Zap, FileText } from 'lucide-react';

export default function SetupGuidePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integration Setup Guide</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to connect Airbyte, n8n, and dbt to automate your emissions data flow
        </p>
      </div>

      <Tabs defaultValue="airbyte" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="airbyte">Airbyte</TabsTrigger>
          <TabsTrigger value="n8n">n8n</TabsTrigger>
          <TabsTrigger value="dbt">dbt</TabsTrigger>
        </TabsList>

        <TabsContent value="airbyte" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Airbyte: Data Integration
              </CardTitle>
              <CardDescription>
                Connect your data sources (Salesforce, Xero, Stripe, etc.) to CarbonSite
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold">Step 1: Create Airbyte Account</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up at{' '}
                  <a
                    href="https://cloud.airbyte.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Airbyte Cloud
                  </a>{' '}
                  or self-host on your infrastructure. Airbyte is free with generous limits.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 2: Create Source Connection</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    In Airbyte, create a new <strong>Source</strong> for your data system:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Salesforce (for facility/customer data)</li>
                    <li>Xero (for invoice data)</li>
                    <li>Stripe (for payment data)</li>
                    <li>Google Sheets (for supplementary data)</li>
                    <li>Custom API (for other sources)</li>
                  </ul>
                  <p className="mt-2">
                    Authenticate using OAuth when available, or API keys stored securely in Airbyte.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 3: Create PostgreSQL Destination</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Create a new <strong>Destination</strong> pointing to CarbonSite's PostgreSQL database:
                  </p>
                  <code className="block bg-slate-100 p-3 rounded text-xs mt-2 text-black">
                    {`Database: your-neon-postgres.neon.tech
Schema: public
Table prefix: staged_external_`}
                  </code>
                  <p className="mt-2">
                    This isolates synced data in the{' '}
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                      staged_external_data
                    </code>{' '}
                    table before transformation.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 4: Create Connection</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Connect your Source to the PostgreSQL Destination. Configure:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>Sync Schedule:</strong> Daily, weekly, or manual
                    </li>
                    <li>
                      <strong>Sync Mode:</strong> Full refresh (overwrites) or incremental (appends)
                    </li>
                    <li>
                      <strong>Stream Selection:</strong> Choose which tables/fields to sync
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 5: Enable Webhooks</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Configure Airbyte to notify CarbonSite when syncs complete. Use this webhook URL:
                  </p>
                  <code className="block bg-slate-100 p-3 rounded text-xs mt-2 text-black font-mono break-all">
                    https://your-domain.com/api/webhooks/airbyte
                  </code>
                  <p className="mt-2">This triggers automatic data processing in CarbonSite.</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm">
                  <strong>Next:</strong> After syncing starts, data flows to{' '}
                  <code className="bg-white px-2 py-1 rounded text-xs">staged_external_data</code>.
                  dbt models transform it into activity records automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="n8n" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                n8n: Workflow Automation
              </CardTitle>
              <CardDescription>
                Automate responses to emissions events (reports, submissions, notifications)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold">Step 1: Create n8n Workflow</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up at{' '}
                  <a
                    href="https://n8n.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    n8n.io
                  </a>
                  . Create a new workflow and add a Webhook trigger.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 2: Configure Webhook Trigger</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Create a Webhook node as the trigger:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>Method:</strong> POST
                    </li>
                    <li>
                      <strong>Authentication:</strong> Use if needed (optional)
                    </li>
                    <li>
                      <strong>Save the webhook URL</strong> (you'll register it in CarbonSite)
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 3: Build Workflow Actions</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Add nodes for your desired actions:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>Send Email:</strong> Gmail, Outlook, SendGrid
                    </li>
                    <li>
                      <strong>Send Slack:</strong> Post to channels or DMs
                    </li>
                    <li>
                      <strong>Create Jira Ticket:</strong> Auto-file bugs from failures
                    </li>
                    <li>
                      <strong>Update Spreadsheet:</strong> Google Sheets, Airtable
                    </li>
                    <li>
                      <strong>Custom Webhook:</strong> Call external APIs
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 4: Register in CarbonSite</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Go to <strong>n8n Workflows</strong> in CarbonSite and click{' '}
                    <strong>New Workflow</strong>. Enter:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>Workflow Name:</strong> e.g., "Report Ready Email"
                    </li>
                    <li>
                      <strong>Trigger:</strong> Report Ready, Field Submission, etc.
                    </li>
                    <li>
                      <strong>Action:</strong> What happens (Send Email, Slack notification)
                    </li>
                    <li>
                      <strong>n8n Webhook URL:</strong> Paste the webhook URL from n8n
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Step 5: Test & Deploy</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Click <strong>Test</strong> in CarbonSite to trigger a sample execution. Monitor
                    logs in both n8n and CarbonSite to ensure workflow works.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm">
                  <strong>Popular Workflows:</strong> Report ready emails, submission approvals,
                  import failure alerts, daily digests, anomaly notifications
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dbt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                dbt: Data Transformation
              </CardTitle>
              <CardDescription>
                Automatically transform synced data into structured activity records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold">How dbt Works</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    dbt is already configured in CarbonSite. When Airbyte syncs data, a dbt job
                    automatically:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Reads from staged_external_data table</li>
                    <li>Cleans and normalizes data (removes duplicates, validates formats)</li>
                    <li>Maps external fields to CarbonSite schema</li>
                    <li>Creates activity_records from transformed data</li>
                    <li>Builds audit trail with lineage</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Data Flow</h3>
                <div className="bg-slate-100 rounded p-4 text-xs font-mono space-y-1">
                  <div>External Data Source (Salesforce, Xero, etc.)</div>
                  <div className="ml-4">↓</div>
                  <div>Airbyte Sync (HTTP API)</div>
                  <div className="ml-4">↓</div>
                  <div>PostgreSQL: staged_external_data</div>
                  <div className="ml-4">↓</div>
                  <div>dbt Models (stg_*, fact_*, agg_*)</div>
                  <div className="ml-4">↓</div>
                  <div>PostgreSQL: activity_records</div>
                  <div className="ml-4">↓</div>
                  <div>CarbonSite Dashboard & Reports</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Key dbt Features</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>Data Lineage:</strong> Trace any activity record back to source
                    </li>
                    <li>
                      <strong>Validation Rules:</strong> Reject invalid data before importing
                    </li>
                    <li>
                      <strong>Incremental Updates:</strong> Only process changed records
                    </li>
                    <li>
                      <strong>Documentation:</strong> Auto-generated data dictionary
                    </li>
                    <li>
                      <strong>Testing:</strong> Built-in quality checks on every run
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Customization</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    To customize dbt transformations, modify models in{' '}
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">dbt/models/</code>:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      <strong>stg_*.sql:</strong> Clean and normalize raw data
                    </li>
                    <li>
                      <strong>fct_*.sql:</strong> Aggregate facts (calculations, summaries)
                    </li>
                    <li>
                      <strong>agg_*.sql:</strong> Pre-computed aggregates for dashboards
                    </li>
                  </ul>
                  <p className="mt-2">Changes deploy automatically via CI/CD.</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm">
                  <strong>Zero Manual Steps:</strong> After Airbyte syncs, dbt runs automatically.
                  No manual data mapping or transformation scripts needed.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Quick Start Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input type="checkbox" id="step1" className="mt-1" />
              <label htmlFor="step1" className="text-sm">
                Create Airbyte Cloud account
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step2" className="mt-1" />
              <label htmlFor="step2" className="text-sm">
                Create first data source connection (e.g., Salesforce)
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step3" className="mt-1" />
              <label htmlFor="step3" className="text-sm">
                Configure PostgreSQL destination
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step4" className="mt-1" />
              <label htmlFor="step4" className="text-sm">
                Enable webhook notification to CarbonSite
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step5" className="mt-1" />
              <label htmlFor="step5" className="text-sm">
                Test first sync
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step6" className="mt-1" />
              <label htmlFor="step6" className="text-sm">
                Create n8n automation (optional)
              </label>
            </div>
            <div className="flex gap-3">
              <input type="checkbox" id="step7" className="mt-1" />
              <label htmlFor="step7" className="text-sm">
                Monitor syncs and workflows in CarbonSite dashboard
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
