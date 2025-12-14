import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import type { Auction } from '@/api/types';
import { Loader2, Gavel, ExternalLink, Play, Square, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function AuctionManagement() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchAuctions = async () => {
    setIsLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await apiClient.auctions.list({ ...params, limit: 100 });
      setAuctions(response.items);
    } catch (error) {
      console.error('Failed to fetch auctions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAuctions(); }, [statusFilter]);

  const handleUpdateStatus = async (auctionId: number, newStatus: string) => {
    setIsProcessing(true);
    try {
      await apiClient.auctions.update(auctionId, { auctionStatus: newStatus });
      toast({ title: 'Status updated' });
      fetchAuctions();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: '' });
    }
  };

  const handleFinalizeAuction = async (auctionId: number) => {
    setIsProcessing(true);
    try {
      await apiClient.status.finalizeAuction(auctionId);
      toast({ title: 'Auction finalized' });
      fetchAuctions();
    } catch (error: any) {
      toast({ title: 'Finalization failed', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: '' });
    }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-600',
      pending: 'bg-yellow-500/10 text-yellow-600',
      ended: 'bg-blue-500/10 text-blue-600',
      completed: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Auction Management</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {auctions.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-muted-foreground">No auctions found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <Card key={auction.auctionID}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{auction.auctionName}</h3>
                      <Badge className={getStatusColor(auction.auctionStatus || 'pending')}>
                        {auction.auctionStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(auction.startDate), 'PPp')} - {format(new Date(auction.endDate), 'PPp')}
                    </p>
                    <p className="text-sm">Price Step: {formatPrice(auction.priceStep)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/auctions/${auction.auctionID}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    
                    {auction.auctionStatus === 'pending' && (
                      <Button size="sm" onClick={() => { setSelectedAuction(auction); setActionDialog({ open: true, action: 'activate' }); }}>
                        <Play className="h-4 w-4 mr-1" />Start
                      </Button>
                    )}
                    
                    {auction.auctionStatus === 'active' && (
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedAuction(auction); setActionDialog({ open: true, action: 'end' }); }}>
                        <Square className="h-4 w-4 mr-1" />End
                      </Button>
                    )}
                    
                    {auction.auctionStatus === 'ended' && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedAuction(auction); setActionDialog({ open: true, action: 'finalize' }); }}>
                        <CheckCircle className="h-4 w-4 mr-1" />Finalize
                      </Button>
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
              {actionDialog.action === 'activate' && 'Start Auction'}
              {actionDialog.action === 'end' && 'End Auction'}
              {actionDialog.action === 'finalize' && 'Finalize Auction'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {actionDialog.action === 'activate' && 'Are you sure you want to start this auction? It will become visible to bidders.'}
            {actionDialog.action === 'end' && 'Are you sure you want to end this auction early?'}
            {actionDialog.action === 'finalize' && 'This will finalize the auction and notify the winner. This action cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, action: '' })}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedAuction) return;
                if (actionDialog.action === 'activate') handleUpdateStatus(selectedAuction.auctionID, 'active');
                else if (actionDialog.action === 'end') handleUpdateStatus(selectedAuction.auctionID, 'ended');
                else if (actionDialog.action === 'finalize') handleFinalizeAuction(selectedAuction.auctionID);
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
