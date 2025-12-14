import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BidWithDetails } from '@/api/types';
import { formatDistanceToNow } from 'date-fns';

interface BidHistoryProps {
  bids: BidWithDetails[];
  currentUserId?: number;
}

export function BidHistory({ bids, currentUserId }: BidHistoryProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (bids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bid History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No bids yet. Be the first to bid!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bid History ({bids.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {bids.map((bid, index) => (
              <div
                key={bid.bidID}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  bid.bidderID === currentUserId ? 'bg-primary/5 border-primary' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {index === 0 && (
                    <Badge variant="default" className="text-xs">
                      Highest
                    </Badge>
                  )}
                  <div>
                    <p className="font-semibold">
                      {bid.bidder_name || `Bidder #${bid.bidderID}`}
                      {bid.bidderID === currentUserId && (
                        <span className="text-xs text-muted-foreground ml-2">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(bid.bidTime), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <p className="font-bold text-primary">
                  {formatPrice(bid.bidPrice)}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}