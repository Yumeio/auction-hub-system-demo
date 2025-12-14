import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import type { PaymentWithDetails } from '@/api/types';
import { Loader2, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function PaymentOversight() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const response = statusFilter === 'pending'
        ? await apiClient.payments.getPending({ limit: 100 })
        : await apiClient.payments.getMyPayments({ limit: 100 }); // This would need admin endpoint
      setPayments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [statusFilter]);

  const handleProcessPayment = async (paymentId: number) => {
    setIsProcessing(true);
    try {
      await apiClient.payments.process(paymentId);
      toast({ title: 'Payment processed' });
      fetchPayments();
    } catch (error: any) {
      toast({ title: 'Processing failed', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: '' });
    }
  };

  const handleUpdateStatus = async (paymentId: number, status: string) => {
    setIsProcessing(true);
    try {
      await apiClient.payments.updateStatus(paymentId, { payment_status: status });
      toast({ title: 'Status updated' });
      fetchPayments();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: '' });
    }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-600',
      pending: 'bg-yellow-500/10 text-yellow-600',
      processing: 'bg-blue-500/10 text-blue-600',
      failed: 'bg-destructive/10 text-destructive',
      refunded: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Oversight</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="all">All Payments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {payments.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-muted-foreground">No payments found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.paymentID}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{payment.auction_name || `Payment #${payment.paymentID}`}</h3>
                      <Badge className={getStatusColor(payment.paymentStatus)}>
                        {payment.paymentStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {payment.firstName} {payment.lastName} • {payment.user_username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.createdAt), 'PPp')}
                    </p>
                  </div>

                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-bold text-lg">{formatPrice(payment.paymentAmount)}</p>
                      <p className="text-xs text-muted-foreground">{payment.userPaymentMethod}</p>
                    </div>
                    
                    {payment.paymentStatus === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => { setSelectedPayment(payment); setActionDialog({ open: true, action: 'process' }); }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />Process
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setSelectedPayment(payment); setActionDialog({ open: true, action: 'fail' }); }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />Fail
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: open ? actionDialog.action : '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'process' && 'Process Payment'}
              {actionDialog.action === 'fail' && 'Mark Payment as Failed'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {actionDialog.action === 'process' && 'Confirm that this payment has been received and processed successfully.'}
            {actionDialog.action === 'fail' && 'Mark this payment as failed. The user will be notified.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, action: '' })}>Cancel</Button>
            <Button
              variant={actionDialog.action === 'fail' ? 'destructive' : 'default'}
              onClick={() => {
                if (!selectedPayment) return;
                if (actionDialog.action === 'process') handleProcessPayment(selectedPayment.paymentID);
                else if (actionDialog.action === 'fail') handleUpdateStatus(selectedPayment.paymentID, 'failed');
              }}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
