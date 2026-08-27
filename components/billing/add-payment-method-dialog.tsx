'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
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
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        setError('Stripe configuration missing');
        return;
      }

      const stripe = loadStripe(stripeKey);
      setStripePromise(stripe);
    };

    initializeStripe();
  }, []);

  useEffect(() => {
    if (!open) return;

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
          const data = await response.json();
          throw new Error(data.message || 'Failed to create setup intent');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Enter your card details to add a new payment method to your organization.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <p className="mt-4 text-sm text-slate-600">Loading payment form...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-600">
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : setupIntentData && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret: setupIntentData.clientSecret }}>
            <PaymentForm
              setupIntentId={setupIntentData.setupIntentId}
              clientSecret={setupIntentData.clientSecret}
              orgId={orgId}
              onSuccess={() => {
                onOpenChange(false);
                onSuccess();
              }}
              onError={setError}
            />
          </Elements>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
