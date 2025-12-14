import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from './CountdownTimer';
import type { SearchAuctionResult } from '@/api/types';
import { Gavel, Clock, Users } from 'lucide-react';

interface AuctionCardProps {
  auction: SearchAuctionResult;
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'default',
      scheduled: 'secondary',
      ended: 'destructive',
      completed: 'outline',
    };
    return variants[status] || 'default';
  };

  const getImageUrl = (imagePath: string | null | undefined): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `http://localhost:8000/${imagePath}`;
  };

  const currentPrice = auction.highestBidPrice || auction.priceStep;
  const imageUrl = getImageUrl(auction.productImage);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="aspect-video overflow-hidden bg-gradient-to-br from-muted to-muted/50 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={auction.auctionName}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="w-full h-full flex flex-col items-center justify-center">
                    <svg class="h-16 w-16 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-sm text-muted-foreground mt-2">No image</p>
                  </div>
                `;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Gavel className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-2">No image</p>
          </div>
        )}
        {auction.auctionStatus === 'pending' && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500">Live</Badge>
          </div>
        )}
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg line-clamp-2">
            {auction.auctionName}
          </CardTitle>
          <Badge variant={getStatusBadge(auction.auctionStatus || 'pending')}>
            {auction.auctionStatus}
          </Badge>
        </div>
        {auction.productName && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {auction.productName}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Price</p>
            <p className="text-xl font-bold text-primary">
              {formatPrice(currentPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Price Step</p>
            <p className="text-sm font-semibold">
              {formatPrice(auction.priceStep)}
            </p>
          </div>
        </div>

        {auction.timeRemaining !== undefined && auction.timeRemaining > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CountdownTimer endDate={new Date(auction.endDate)} />
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Gavel className="h-4 w-4" />
            <span>{auction.totalBids} bids</span>
          </div>
          {auction.productType && (
            <Badge variant="outline" className="text-xs">
              {auction.productType}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full">
          <Link to={`/auctions/${auction.auctionID}`}>
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}