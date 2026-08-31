'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const INTEGRATIONS = [
  {
    name: 'Xero',
    icon: '💼',
    status: 'connected',
    description: 'Automatically sync invoices and spend data to calculate Scope 3 emissions.',
    benefits: ['Sync purchase invoices', 'Auto-categorize suppliers', 'Track spending patterns'],
    setupUrl: '/integrations/xero/setup',
    docs: 'https://xero.com/docs',
  },
  {
    name: 'QuickBooks',
    icon: '📊',
    status: 'connected',
    description: 'Pull transaction data and vendor information to build your supply chain profile.',
    benefits: ['Import transactions', 'Map vendors automatically', 'Track supplier emissions'],
    setupUrl: '/integrations/quickbooks/setup',
    docs: 'https://quickbooks.intuit.com/docs',
  },
  {
    name: 'Sage',
    icon: '📈',
    status: 'connected',
    description: 'Connect your Sage accounting to streamline emissions reporting.',
    benefits: ['Sync business expenses', 'Link vendor data', 'Generate compliance reports'],
    setupUrl: '/integrations/sage/setup',
    docs: 'https://sage.com/docs',
  },
];

export default function AccountingIntegrationsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accounting Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your accounting software to automatically pull supplier data and calculate emissions from your spending.
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-6">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.name} className="overflow-hidden hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{integration.icon}</div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {integration.name}
                      {integration.status === 'connected' && (
                        <Badge variant="outline" className="ml-2">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Ready
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{integration.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">What you get:</h4>
                <ul className="space-y-1">
                  {integration.benefits.map((benefit) => (
                    <li key={benefit} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <Button asChild>
                  <Link href={integration.setupUrl}>
                    <Zap className="w-4 h-4 mr-2" />
                    Connect Now
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href={integration.docs} target="_blank" rel="noopener noreferrer">
                    Documentation
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            Connect any accounting software to automatically pull your supplier spending data. Our system analyzes this data to calculate emissions from your purchases (Scope 3).
          </p>
          <p>
            Each integration securely authenticates with your accounting platform and syncs data on a schedule you control. Your financial data never leaves your systems.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
