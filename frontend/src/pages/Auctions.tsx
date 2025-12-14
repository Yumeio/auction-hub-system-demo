import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api';
import type { SearchAuctionResult } from '@/api/types';
import { Search, Grid, List, Loader2, X, Filter, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auctions() {
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<SearchAuctionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 12;

  const fetchAuctions = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        skip: page * limit,
        limit,
      };

      if (searchQuery) {
        params.auction_name = searchQuery;
      }

      if (statusFilter !== 'all') {
        params.auction_status = statusFilter === 'ongoing' ? 'pending' : statusFilter;
      }

      if (productTypeFilter !== 'all') {
        params.product_type = productTypeFilter;
      }

      if (minPrice) {
        params.min_price_step = parseFloat(minPrice);
      }

      if (maxPrice) {
        params.max_price_step = parseFloat(maxPrice);
      }

      const response = await apiClient.search.auctionsByQuery(params);

      setAuctions(response?.items || []);
      setTotal(response?.total || 0);

    } catch (error: any) {
      toast({
        title: 'Lỗi tải danh sách đấu giá',
        description: error.response?.data?.detail || error.message || 'Không thể tải danh sách đấu giá. Vui lòng thử lại.',
        variant: 'destructive',
      });
      setAuctions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [page, statusFilter, productTypeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchAuctions();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setProductTypeFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setPage(0);
    setTimeout(() => fetchAuctions(), 0);
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || productTypeFilter !== 'all' || minPrice || maxPrice;
  const totalPages = Math.ceil(total / limit);

  return (
    <MainLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Browse Auctions</h1>
          <p className="text-muted-foreground">
            Discover unique items and place your bids
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search auctions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit">Search</Button>
            </form>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setPage(0); // Reset page when filter changes
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={showAdvancedFilters ? 'bg-accent' : ''}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>

              <div className="hidden md:flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Type</label>
                <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                    <SelectItem value="art">Art</SelectItem>
                    <SelectItem value="collectibles">Collectibles</SelectItem>
                    <SelectItem value="jewelry">Jewelry</SelectItem>
                    <SelectItem value="antiques">Antiques</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Min Price</label>
                <Input
                  type="number"
                  placeholder="Min price"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Price</label>
                <Input
                  type="number"
                  placeholder="Max price"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                <Button variant="outline" onClick={clearFilters} size="sm">
                  Clear Filters
                </Button>
                <Button onClick={handleSearch} size="sm">
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Active filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <button onClick={() => { setSearchQuery(''); fetchAuctions(); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <button onClick={() => { setStatusFilter('all'); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {productTypeFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Type: {productTypeFilter}
                <button onClick={() => { setProductTypeFilter('all'); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {minPrice && (
              <Badge variant="secondary" className="gap-1">
                Min: ${minPrice}
                <button onClick={() => { setMinPrice(''); fetchAuctions(); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {maxPrice && (
              <Badge variant="secondary" className="gap-1">
                Max: ${maxPrice}
                <button onClick={() => { setMaxPrice(''); fetchAuctions(); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : auctions.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total} auctions
            </div>

            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
            >
              {auctions.map((auction) => (
                <AuctionCard key={auction.auctionID} auction={auction} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              No auctions found. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
