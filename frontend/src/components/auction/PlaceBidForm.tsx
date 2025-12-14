import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api';
import { Loader2 } from 'lucide-react';

interface PlaceBidFormProps {
  auctionId: number;
  currentPrice: number;
  priceStep: number;
  isParticipant: boolean;
  onBidPlaced: () => void;
}

export function PlaceBidForm({
  auctionId,
  currentPrice,
  priceStep,
  isParticipant,
  onBidPlaced,
}: PlaceBidFormProps) {
  const [bidAmount, setBidAmount] = useState(currentPrice + priceStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const minimumBid = currentPrice + priceStep;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (bidAmount < minimumBid) {
      toast({
        title: 'Invalid bid',
        description: `Minimum bid is ${formatPrice(minimumBid)}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await apiClient.bids.place({
        auctionID: auctionId,
        bidPrice: bidAmount,
      });
      
      toast({
        title: 'Bid placed!',
        description: `Your bid of ${formatPrice(bidAmount)} has been placed.`,
      });
      
      onBidPlaced();
      setBidAmount(bidAmount + priceStep);
    } catch (error: any) {
      toast({
        title: 'Failed to place bid',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickBidAmounts = [
    minimumBid,
    minimumBid + priceStep,
    minimumBid + priceStep * 2,
    minimumBid + priceStep * 5,
  ];

  if (!isParticipant) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        You must register for this auction to place bids.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bidAmount">Your Bid (VND)</Label>
        <Input
          id="bidAmount"
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(Number(e.target.value))}
          min={minimumBid}
          step={priceStep}
          disabled={isSubmitting}
          placeholder="Enter bid amount"
        />
        <p className="text-xs text-muted-foreground">
          Minimum bid: {formatPrice(minimumBid)} • Bid step: {formatPrice(priceStep)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickBidAmounts.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBidAmount(amount)}
            disabled={isSubmitting}
          >
            {formatPrice(amount)}
          </Button>
        ))}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Placing Bid...
          </>
        ) : (
          `Place Bid - ${formatPrice(bidAmount)}`
        )}
      </Button>
    </form>
  );
}
