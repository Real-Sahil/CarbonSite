'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaymentForm } from './payment-form';

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onSuccess: () => void;
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: AddPaymentMethodDialogProps) {
  const [setupIntentData, setSetupIntentData] = useState<{
    clientSecret: string;
    setupIntentId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    // Fetch SetupIntent
    const fetchSetupIntent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/orgs/${orgId}/billing/setup-intent`,
          {
            method: 'POST',
          },
        );

        if (!response.ok) {
          throw new Error('Failed to create setup intent');
        }

        const data = await response.json();
        setSetupIntentData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetupIntent();
  }, [open, orgId]);

  const handleSuccess = async () => {
    if (!setupIntentData) return;

    try {
      // Send the SetupIntent ID to the backend to save the payment method
      const response = await fetch(
        `/api/orgs/${orgId}/billing/payment-methods`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            setupIntentId: setupIntentData.setupIntentId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to save payment method');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Enter your card details to add a new payment method to your organization.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-slate-600">
            Loading payment form...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-600">
            {error}
          </div>
        ) : setupIntentData ? (
          <PaymentForm
            setupIntentId={setupIntentData.setupIntentId}
            clientSecret={setupIntentData.clientSecret}
            onSuccess={handleSuccess}
            onError={(err) => setError(err)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
