import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Gavel, 
  Package, 
  Receipt, 
  TrendingUp, 
  ArrowRight, 
  Loader2,
  Award,
  Clock
} from 'lucide-react';
import type { BidWithDetails } from '@/api/types';

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeBids: 0,
    wonAuctions: 0,
    totalBids: 0,
    pendingPayments: 0,
  });
  const [recentBids, setRecentBids] = useState<BidWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bidsResponse, paymentsResponse] = await Promise.all([
          apiClient.bids.getMyBids({ limit: 100 }),
          apiClient.payments.getMyPayments({ limit: 100 }),
        ]);

        // Safely access items with fallback to empty array
        const bidItems = bidsResponse?.items || [];
        const paymentItems = paymentsResponse?.items || [];

        const activeBids = bidItems.filter(
          (bid) => bid.bidStatus === 'active'
        ).length;
        const wonAuctions = bidItems.filter(
          (bid) => bid.bidStatus === 'won'
        ).length;
        const pendingPayments = paymentItems.filter(
          (payment) => payment.paymentStatus === 'pending'
        ).length;

        setStats({
          activeBids,
          wonAuctions,
          totalBids: bidItems.length,
          pendingPayments,
        });

        setRecentBids(bidItems.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const statCards = [
    {
      title: 'Active Bids',
      value: stats.activeBids,
      icon: Gavel,
      href: '/dashboard/bids?status=active',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Won Auctions',
      value: stats.wonAuctions,
      icon: Award,
      href: '/dashboard/bids?status=won',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Total Bids',
      value: stats.totalBids,
      icon: TrendingUp,
      href: '/dashboard/bids',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Pending Payments',
      value: stats.pendingPayments,
      icon: Receipt,
      href: '/dashboard/payments',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: 'default', label: 'Active' },
      won: { variant: 'default', label: 'Won' },
      outbid: { variant: 'secondary', label: 'Outbid' },
      lost: { variant: 'outline', label: 'Lost' },
    };
    return variants[status] || { variant: 'outline', label: status };
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName}!</h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your auction activity.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <Link
                    to={stat.href}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center mt-1"
                  >
                    View details
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Bids */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Bids</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard/bids">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentBids.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bids yet. Start bidding on auctions!</p>
                  <Button variant="outline" className="mt-4" asChild>
                    <Link to="/auctions">Browse Auctions</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBids.map((bid) => (
                    <div
                      key={bid.bidID}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {bid.auction_name || 'Auction'}
                          </p>
                          <Badge variant={getStatusBadge(bid.bidStatus || '').variant}>
                            {getStatusBadge(bid.bidStatus || '').label}
                          </Badge>
                        </div>
                        {bid.product_name && (
                          <p className="text-sm text-muted-foreground truncate">
                            {bid.product_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold">{formatPrice(bid.bidPrice)}</p>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/auctions/${bid.auctionID}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button asChild className="w-full">
                <Link to="/auctions">
                  <Gavel className="mr-2 h-4 w-4" />
                  Browse Auctions
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/dashboard/products/new">
                  <Package className="mr-2 h-4 w-4" />
                  List a Product
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/dashboard/profile">
                  <Clock className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}