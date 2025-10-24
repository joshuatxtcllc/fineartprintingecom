import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

interface OrderPaymentFormProps {
  orderId: string;
  amount: number;
  customerName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function OrderPaymentForm({ orderId, amount, customerName, onSuccess, onCancel }: OrderPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent for ORDER
      const response = await apiRequest('POST', `/api/orders/${orderId}/create-payment-intent`);
      const { clientSecret } = await response.json();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: customerName,
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        toast({
          title: "Payment Failed",
          description: stripeError.message,
          variant: "destructive",
        });
      } else if (paymentIntent?.status === 'succeeded') {
        setSucceeded(true);
        toast({
          title: "Payment Successful",
          description: `Payment of $${amount.toFixed(2)} has been processed successfully.`,
        });
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during payment processing');
      toast({
        title: "Payment Error",
        description: err.message || 'An error occurred during payment processing',
        variant: "destructive",
      });
    }

    setProcessing(false);
  };

  if (succeeded) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700 mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground">
              Your order payment of ${amount.toFixed(2)} has been processed successfully.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Complete Your Order
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Order for {customerName}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 border rounded-md">
            <div className="mb-2 text-sm font-medium">Total Amount</div>
            <div className="text-2xl font-bold">${amount.toFixed(2)}</div>
          </div>

          <div className="p-4 border rounded-md">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!stripe || processing}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay $${amount.toFixed(2)}`
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={processing}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface OrderPaymentProps {
  orderId: string;
  amount: number;
  customerName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function OrderPayment({ orderId, amount, customerName, onSuccess, onCancel }: OrderPaymentProps) {
  if (!stripePromise) {
    return (
      <div className="p-4 border border-red-200 rounded bg-red-50">
        <p className="text-red-800">Stripe is not configured. Please add your VITE_STRIPE_PUBLISHABLE_KEY to environment variables.</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <OrderPaymentForm
        orderId={orderId}
        amount={amount}
        customerName={customerName}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
