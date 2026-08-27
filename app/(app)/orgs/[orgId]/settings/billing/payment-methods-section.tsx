'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddPaymentMethodDialog } from '@/components/billing/add-payment-method-dialog';
import { AlertCircle, CreditCard, Loader2, Trash2, Check } from 'lucide-react';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export function PaymentMethodsSection({ orgId }: { orgId: string }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/orgs/${orgId}/billing/payment-methods`,
      );

      if (!response.ok) {
        throw new Error('Failed to load payment methods');
      }

      const data = await response.json();
      setPaymentMethods(data.paymentMethods);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment methods';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, [orgId]);

  const handleDelete = async (methodId: string) => {
    try {
      setDeleting(methodId);

      const response = await fetch(
        `/api/orgs/${orgId}/billing/payment-methods/${methodId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      setPaymentMethods((prev) => prev.filter((m) => m.id !== methodId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete payment method';
      setError(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await fetch(
        `/api/orgs/${orgId}/billing/payment-methods/${methodId}`,
        {
          method: 'PATCH',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      setPaymentMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isDefault: m.id === methodId,
        })),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default payment method';
      setError(errorMessage);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Payment Methods</h3>
          <p className="text-sm text-slate-600 mt-1">
            Manage your payment methods for billing
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      {error && (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : paymentMethods.length === 0 ? (
        <div className="text-center py-8 text-slate-600">
          <p className="text-sm">No payment methods added yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Add a payment method to enable automatic billing
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">
                    {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} ending in {method.last4}
                  </p>
                  <p className="text-sm text-slate-600">
                    Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {method.isDefault && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">Default</span>
                  </div>
                )}
                {!method.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(method.id)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Make Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(method.id)}
                  disabled={deleting === method.id || (method.isDefault && paymentMethods.length === 1)}
                  className="text-slate-600 hover:text-red-600"
                >
                  {deleting === method.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPaymentMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        onSuccess={fetchPaymentMethods}
      />
    </Card>
  );
}
