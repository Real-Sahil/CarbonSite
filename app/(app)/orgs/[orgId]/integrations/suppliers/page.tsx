'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, LinkIcon, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const SAMPLE_SUPPLIERS = [
  {
    id: '1',
    name: 'Supplier A',
    status: 'submitted',
    lastActivity: '2 days ago',
  },
  {
    id: '2',
    name: 'Supplier B',
    status: 'pending',
    lastActivity: '5 days ago',
  },
];

export default function SuppliersPage() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Management</h1>
          <p className="text-muted-foreground mt-2">
            Invite suppliers to share their emissions data and contribution to your Scope 3 footprint.
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(!showInviteDialog)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Supplier
        </Button>
      </div>

      {/* Invite Form (if showing) */}
      {showInviteDialog && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Invite a Supplier</CardTitle>
            <CardDescription>Send an invite link for suppliers to submit their emissions data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier Name</label>
              <input
                type="text"
                placeholder="e.g., Acme Manufacturing"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Email (optional)</label>
              <input
                type="email"
                placeholder="supplier@example.com"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              We'll generate a unique invite link. Share it with your supplier via email or any communication channel. They don't need to create an account — just follow the link and submit their data.
            </p>
            <div className="flex gap-2">
              <Button className="w-full">Generate Invite Link</Button>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            How Supplier Invites Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h4 className="font-semibold text-foreground mb-1">1. You send an invite</h4>
            <p>Click "Invite Supplier" and we generate a unique link. Share it however you like — email, Slack, WhatsApp, etc.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">2. Supplier follows the link</h4>
            <p>They don't need to create an account or log in. The link opens a form where they can enter their company name and emissions data.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">3. You review and approve</h4>
            <p>Submissions appear in your dashboard. Review the data, ask questions, and approve once verified. Approved data flows into your Scope 3 calculations.</p>
          </div>
        </CardContent>
      </Card>

      {/* Supplier List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Suppliers</h2>
        <div className="grid gap-4">
          {SAMPLE_SUPPLIERS.map((supplier) => (
            <Card key={supplier.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{supplier.name}</h3>
                    <p className="text-sm text-muted-foreground">Last activity: {supplier.lastActivity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={supplier.status === 'submitted' ? 'default' : 'secondary'}>
                      {supplier.status === 'submitted' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Data Submitted
                        </>
                      ) : (
                        'Awaiting Response'
                      )}
                    </Badge>
                    <Button variant="outline" size="sm">
                      View Submission
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
