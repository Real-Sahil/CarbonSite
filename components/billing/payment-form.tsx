'use client';

import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

function sanitizeStripeErrorMessage(message: string): string {
  if (!message) return 'Payment processing failed';
  const apiKeyPattern = /sk_(test|live)_[a-zA-Z0-9]{24,}/g;
  const sanitized = message.replace(apiKeyPattern, '[API_KEY_REDACTED]');
  return sanitized || 'Payment processing failed';
}

interface PaymentFormProps {
  setupIntentId: string;
  clientSecret: string;
  orgId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PaymentForm({
  setupIntentId,
  clientSecret,
  orgId,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!stripe || !elements) {
      setError('Stripe has not loaded');
      setIsLoading(false);
      return;
    }

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        const sanitizedMessage = sanitizeStripeErrorMessage(stripeError.message || '');
        throw new Error(sanitizedMessage);
      }

      if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
        const response = await fetch(`/api/orgs/${orgId}/billing/payment-methods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupIntentId: setupIntent.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to save payment method');
        }

        onSuccess();
      } else {
        throw new Error('Setup intent did not succeed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="p-3 border border-slate-200 rounded-lg bg-white">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#1e293b',
                '::placeholder': {
                  color: '#cbd5e1',
                },
              },
              invalid: {
                color: '#dc2626',
              },
            },
          }}
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding Card...
          </>
        ) : (
          'Add Card'
        )}
      </Button>

      <p className="text-xs text-slate-500 text-center">
        Card details are securely processed by Stripe
      </p>
    </form>
  );
}
