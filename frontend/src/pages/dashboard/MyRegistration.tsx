import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, Calendar, Clock, DollarSign, Clock3, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiClient } from '@/api';
import type { ParticipationWithDetails } from '@/api/types';

const getDepositStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'paid':
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Paid</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'refunded':
      return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getAuctionStatusBadge = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Active</Badge>;
    case 'ended':
      return <Badge variant="secondary">Ended</Badge>;
    case 'pending':
      return <Badge variant="outline">Upcoming</Badge>;
    case 'completed':
      return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Completed</Badge>;
    default:
      return <Badge variant="outline">{status || 'Unknown'}</Badge>;
  }
};

export default function MyRegistrations() {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<ParticipationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingDeposit, setPayingDeposit] = useState<ParticipationWithDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      const response = await apiClient.participations.getMyRegistrations({ limit: 100 });
      setRegistrations(response.items);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
      toast.error('Failed to load registrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayDeposit = async (registration: ParticipationWithDetails) => {
    setPayingDeposit(registration);
  };

  const confirmPayDeposit = async () => {
    if (!payingDeposit) return;

    setIsProcessing(true);
    try {
      const response = await apiClient.bank.createDeposit(payingDeposit.auctionID);
      
      if (response.success) {
        toast.success('Deposit initiated successfully!');
        // Navigate to payment page with transaction details
        navigate(`/payment?type=deposit&transactionId=${response.transactionID}&auctionId=${payingDeposit.auctionID}`);
      } else {
        toast.error(response.message || 'Failed to initiate deposit');
      }
    } catch (error: any) {
      console.error('Failed to create deposit:', error);
      toast.error(error.response?.data?.detail || 'Failed to initiate deposit payment');
    } finally {
      setIsProcessing(false);
      setPayingDeposit(null);
    }
  };

  const isPendingDeposit = (status: string) => {
    return status.toLowerCase() === 'pending';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Registrations</h1>
        <p className="text-muted-foreground">
          Auctions you've registered for and their deposit status
        </p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No registrations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Register for auctions to participate in bidding
            </p>
            <Button asChild>
              <Link to="/auctions">Browse Auctions</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registrations.map((registration) => (
            <Card key={registration.participationID} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">
                      {registration.auctionName || `Auction #${registration.auctionID}`}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {registration.productName || 'Product'}
                    </CardDescription>
                  </div>
                  {getAuctionStatusBadge(registration.auctionStatus)}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Deposit
                    </span>
                    <span className="font-medium">
                      ${registration.depositAmount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deposit Status</span>
                    {getDepositStatusBadge(registration.depositStatus)}
                  </div>
                  {registration.startDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Start
                      </span>
                      <span className="text-xs">
                        {format(new Date(registration.startDate), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  )}
                  {registration.endDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        End
                      </span>
                      <span className="text-xs">
                        {format(new Date(registration.endDate), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Registered</span>
                    <span className="text-xs">
                      {format(new Date(registration.registrationDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isPendingDeposit(registration.depositStatus) && (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handlePayDeposit(registration)}
                    >
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                      Pay Deposit
                    </Button>
                  )}
                  <Button asChild variant="outline" className="flex-1" size="sm">
                    <Link to={`/auctions/${registration.auctionID}`}>
                      View Auction
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Confirmation Dialog */}
      <Dialog open={!!payingDeposit} onOpenChange={() => setPayingDeposit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Deposit</DialogTitle>
            <DialogDescription>
              You are about to pay the deposit for this auction registration.
            </DialogDescription>
          </DialogHeader>
          {payingDeposit && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Auction</span>
                  <span className="font-medium">
                    {payingDeposit.auctionName || `Auction #${payingDeposit.auctionID}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{payingDeposit.productName || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Deposit Amount</span>
                  <span className="font-bold text-lg">
                    ${payingDeposit.depositAmount?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                After payment, you'll be able to participate in bidding. Deposits are refundable if you don't win the auction.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPayingDeposit(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={confirmPayDeposit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
