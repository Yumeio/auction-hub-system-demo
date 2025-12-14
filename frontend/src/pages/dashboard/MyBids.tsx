import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { apiClient } from '@/api';
import type { BidWithDetails } from '@/api/types';
import {
  Loader2,
  ExternalLink,
  Gavel,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  Trophy,
  RefreshCw,
  X,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { formatDistanceToNow, format, isAfter, isBefore, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function MyBids() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [bids, setBids] = useState<BidWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000000]);
  const [showFilters, setShowFilters] = useState(false);

  const defaultTab = searchParams.get('status') || 'all';

  useEffect(() => {
    fetchBids();
    // Set up auto-refresh every 30 seconds for active bids
    const interval = setInterval(() => {
      fetchBids(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchBids = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const response = await apiClient.bids.getMyBids({ limit: 1000 }) as any;
      // Handle both possible response structures (pagination wrapper or direct format)
      const bidItems = response.data || response.items || [];
      const mappedBids: BidWithDetails[] = Array.isArray(bidItems) ? bidItems.map((item: any) => ({
        ...item,
        bidID: item.bid_id || item.bidID,
        auctionID: item.auction_id || item.auctionID,
        userID: item.user_id || item.userID,
        bidPrice: item.bid_price_raw !== undefined ? item.bid_price_raw : item.bidPrice,
        bidTime: item.bid_time || item.created_at || item.bidTime, // prefer ISO string
        bidStatus: item.bid_status || item.bidStatus,
        auction_name: item.auction_name,
        product_name: item.product_name
      })) : [];

      setBids(mappedBids);
    } catch (error) {
      console.error('Failed to fetch bids:', error);
      setBids([]); // Reset to empty array on error
      toast({
        title: 'Error',
        description: 'Failed to load bids. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { className: string; label: string; icon: any }> = {
      active: {
        className: 'bg-blue-500/10 text-blue-600 border-blue-200',
        label: 'Active',
        icon: Clock,
      },
      won: {
        className: 'bg-green-500/10 text-green-600 border-green-200',
        label: 'Won',
        icon: Trophy,
      },
      outbid: {
        className: 'bg-orange-500/10 text-orange-600 border-orange-200',
        label: 'Outbid',
        icon: TrendingDown,
      },
      lost: {
        className: 'bg-muted text-muted-foreground',
        label: 'Lost',
        icon: X,
      },
      cancelled: {
        className: 'bg-destructive/10 text-destructive border-destructive/20',
        label: 'Cancelled',
        icon: X,
      },
      winning: {
        className: 'bg-green-500/10 text-green-600 border-green-200',
        label: 'Winning',
        icon: Trophy,
      },
    };
    return configs[status] || configs.lost;
  };

  // Advanced filtering
  const filteredBids = useMemo(() => {
    if (!Array.isArray(bids)) return [];
    let filtered = [...bids];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (bid) =>
          bid.auction_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          bid.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          bid.bidID.toString().includes(searchQuery)
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((bid) => isAfter(parseISO(bid.bidTime), dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter((bid) => isBefore(parseISO(bid.bidTime), dateTo));
    }

    // Price range filter
    filtered = filtered.filter(
      (bid) => bid.bidPrice >= priceRange[0] && bid.bidPrice <= priceRange[1]
    );

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime();
          break;
        case 'price':
          comparison = b.bidPrice - a.bidPrice;
          break;
        case 'status':
          const statusOrder = { won: 0, active: 1, outbid: 2, lost: 3, cancelled: 4 };
          comparison =
            (statusOrder[a.bidStatus as keyof typeof statusOrder] || 5) -
            (statusOrder[b.bidStatus as keyof typeof statusOrder] || 5);
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [bids, searchQuery, dateFrom, dateTo, priceRange, sortBy, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = bids.length;
    const active = bids.filter((b) => b.bidStatus === 'active').length;
    const won = bids.filter((b) => ['won', 'winning'].includes(b.bidStatus || '')).length;
    const lost = bids.filter((b) => ['outbid', 'lost'].includes(b.bidStatus || '')).length;
    const totalAmount = bids.reduce((sum, bid) => sum + bid.bidPrice, 0);
    const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0';
    const avgBid = total > 0 ? totalAmount / total : 0;

    return { total, active, won, lost, totalAmount, winRate, avgBid };
  }, [bids]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Bid ID', 'Auction', 'Product', 'Bid Price', 'Status', 'Bid Time'];
    const rows = filteredBids.map((bid) => [
      bid.bidID,
      bid.auction_name || 'N/A',
      bid.product_name || 'N/A',
      bid.bidPrice,
      bid.bidStatus || 'N/A',
      format(new Date(bid.bidTime), 'dd/MM/yyyy HH:mm'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `my-bids-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: 'Export Successful',
      description: `Exported ${filteredBids.length} bids to CSV`,
    });
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPriceRange([0, 100000000]);
    setSortBy('date');
    setSortOrder('desc');
  };

  const activeBids = filteredBids.filter((b) => b.bidStatus === 'active');
  const wonBids = filteredBids.filter((b) => ['won', 'winning'].includes(b.bidStatus || ''));
  const lostBids = filteredBids.filter((b) =>
    ['outbid', 'lost'].includes(b.bidStatus || '')
  );

  const renderBidList = (bidList: BidWithDetails[]) => {
    if (bidList.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <Gavel className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">No bids found</h3>
          <p className="text-sm mb-4">
            {searchQuery || dateFrom || dateTo
              ? 'Try adjusting your filters'
              : 'Start bidding on auctions'}
          </p>
          {!searchQuery && !dateFrom && !dateTo && (
            <Button asChild>
              <Link to="/auctions">Browse Auctions</Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {bidList.map((bid) => {
          const statusConfig = getStatusBadge(bid.bidStatus || 'active');
          const StatusIcon = statusConfig.icon;

          return (
            <Card key={bid.bidID} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">
                        {bid.auction_name || 'Auction'}
                      </h3>
                      <Badge className={statusConfig.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    {bid.product_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {bid.product_name}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(bid.bidTime), { addSuffix: true })}
                      </span>
                      <span>Bid #{bid.bidID}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="text-right flex-1 sm:flex-none">
                      <p className="text-sm text-muted-foreground">Your Bid</p>
                      <p className="font-bold text-lg text-primary">
                        {formatPrice(bid.bidPrice)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/auctions/${bid.auctionID}`}>
                          View
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                      {bid.bidStatus === 'outbid' && (
                        <Button size="sm" asChild>
                          <Link to={`/auctions/${bid.auctionID}`}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Rebid
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">My Bids</h1>
            {isRefreshing && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-muted-foreground mt-1">Track all your auction bids</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchBids()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.won}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lost}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.winRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Bid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatPrice(stats.avgBid)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by auction, product, or bid ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sort By */}
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4" />
                          Descending
                        </div>
                      </SelectItem>
                      <SelectItem value="asc">
                        <div className="flex items-center gap-2">
                          <ChevronUp className="h-4 w-4" />
                          Ascending
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label>
                  Price Range: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                </Label>
                <Slider
                  min={0}
                  max={100000000}
                  step={1000000}
                  value={priceRange}
                  onValueChange={(v) => setPriceRange(v as [number, number])}
                  className="w-full"
                />
              </div>

              {/* Clear Filters */}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} onValueChange={(v) => setSearchParams({ status: v })}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All <span className="ml-1 text-xs">({filteredBids.length})</span>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active <span className="ml-1 text-xs">({activeBids.length})</span>
          </TabsTrigger>
          <TabsTrigger value="won">
            Won <span className="ml-1 text-xs">({wonBids.length})</span>
          </TabsTrigger>
          <TabsTrigger value="lost">
            Lost <span className="ml-1 text-xs">({lostBids.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {renderBidList(filteredBids)}
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {renderBidList(activeBids)}
        </TabsContent>

        <TabsContent value="won" className="mt-6">
          {renderBidList(wonBids)}
        </TabsContent>

        <TabsContent value="lost" className="mt-6">
          {renderBidList(lostBids)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
