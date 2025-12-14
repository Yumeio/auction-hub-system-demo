import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, QrCode, CheckCircle, XCircle, Clock, CreditCard, ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { apiClient } from '@/api';
import type { BankTransaction } from '@/api/types';
import { MainLayout } from '@/components/layout/MainLayout';

export default function BankPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const transactionId = searchParams.get('transactionId');
  const paymentId = searchParams.get('paymentId');
  const type = searchParams.get('type') || 'payment'; // 'deposit' or 'payment'

  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!transactionId) {
      toast.error('Transaction ID is required');
      navigate('/dashboard/payments');
      return;
    }

    const fetchTransaction = async () => {
      try {
        let txn: BankTransaction;
        
        if (type === 'deposit') {
          txn = await apiClient.bank.getDepositStatus(transactionId);
        } else {
          txn = await apiClient.bank.getPaymentStatus(transactionId);
        }
        
        setTransaction(txn);

        // Get QR code if pending
        if (txn.status === 'pending' && type === 'payment') {
          const qrResponse = await apiClient.bank.getPaymentQR(transactionId);
          setQrCode(qrResponse.qr_code);
        } else if (txn.qrCode) {
          setQrCode(txn.qrCode);
        }
      } catch (error) {
        console.error('Failed to fetch transaction:', error);
        toast.error('Failed to load payment details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();

    // Poll for status updates
    const interval = setInterval(fetchTransaction, 5000);
    return () => clearInterval(interval);
  }, [transactionId, type, navigate]);

  const handleConfirmPayment = async () => {
    if (!transactionId || !paymentId) {
      toast.error('Missing payment information');
      return;
    }

    setIsConfirming(true);

    try {
      await apiClient.bank.confirmPayment({
        transaction_id: transactionId,
        payment_id: parseInt(paymentId),
      });
      toast.success('Payment confirmed successfully!');
      // Refresh transaction status
      const txn = await apiClient.bank.getPaymentStatus(transactionId);
      setTransaction(txn);
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      toast.error('Failed to confirm payment');
    } finally {
      setIsConfirming(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-destructive/10 text-destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!transaction) {
    return (
      <MainLayout>
        <div className="container max-w-2xl py-8">
          <Card>
            <CardContent className="py-16 text-center">
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="font-medium mb-2">Transaction not found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The requested transaction could not be found
              </p>
              <Button onClick={() => navigate('/dashboard/payments')}>
                Go to Payments
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-2xl py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {type === 'deposit' ? 'Deposit Payment' : 'Auction Payment'}
            </CardTitle>
            <CardDescription>
              Complete your payment using the QR code below
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Amount Due</p>
                <p className="text-3xl font-bold">{formatAmount(transaction.amount)}</p>
              </div>
              {getStatusBadge(transaction.status)}
            </div>

            {transaction.status === 'pending' && qrCode && (
              <>
                <div className="flex flex-col items-center p-6 border rounded-lg">
                  <QrCode className="h-8 w-8 text-muted-foreground mb-4" />
                  <div className="bg-background p-4 rounded-lg border">
                    {/* Display QR code - assuming it's a base64 image or URL */}
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="Payment QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Scan this QR code with your banking app to complete the payment
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Transaction ID</p>
                      <p className="font-mono text-sm">{transaction.transactionID}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(transaction.transactionID)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {paymentId && (
                  <Button
                    className="w-full"
                    onClick={handleConfirmPayment}
                    disabled={isConfirming}
                  >
                    {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    I've Completed the Payment
                  </Button>
                )}
              </>
            )}

            {transaction.status === 'completed' && (
              <div className="flex flex-col items-center py-8">
                <div className="p-4 rounded-full bg-green-500/10 mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Your payment has been processed successfully
                </p>
                <Button onClick={() => navigate('/dashboard/payments')}>
                  View All Payments
                </Button>
              </div>
            )}

            {transaction.status === 'failed' && (
              <div className="flex flex-col items-center py-8">
                <div className="p-4 rounded-full bg-destructive/10 mb-4">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Payment Failed</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Your payment could not be processed. Please try again.
                </p>
                <Button onClick={() => navigate('/dashboard/payments')}>
                  Back to Payments
                </Button>
              </div>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground text-center">
              <p>
                Created: {new Date(transaction.createdAt).toLocaleString()}
              </p>
              {transaction.updatedAt && (
                <p>
                  Last Updated: {new Date(transaction.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
