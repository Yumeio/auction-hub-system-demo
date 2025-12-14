import { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlaceBidForm } from '@/components/auction/PlaceBidForm';
import { apiClient } from '@/api';
import type { SearchAuctionResult } from '@/api/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Gavel,
  Search,
  TrendingUp,
  Loader2,
  ExternalLink,
  Trophy,
  Clock,
  Users,
  UserPlus
} from 'lucide-react';

export default function Bids() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Data states
  const [auctions, setAuctions] = useState<SearchAuctionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAuctions, setFilteredAuctions] = useState<SearchAuctionResult[]>([]);

  // Dialog & Interaction states
  const [selectedAuction, setSelectedAuction] = useState<SearchAuctionResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [participationMap, setParticipationMap] = useState<Record<number, boolean>>({});
  const [isCheckingParticipation, setIsCheckingParticipation] = useState<Record<number, boolean>>({});
  const [isRegistering, setIsRegistering] = useState<Record<number, boolean>>({});

  // Auto-bid states
  const [pendingBid, setPendingBid] = useState<{ auctionId: number, amount: number } | null>(null);
  const [inputBidAmount, setInputBidAmount] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);

  // Deposit payment dialog states
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);


  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.search.auctionsByQuery({
          auction_status: 'pending',
          limit: 100,
        });

        const auctionItems = response?.items || [];
        setAuctions(auctionItems);
        setFilteredAuctions(auctionItems);

        if (isAuthenticated && auctionItems.length > 0) {
          checkParticipations(auctionItems.map(a => a.auctionID));
        }
      } catch (error) {
        console.error('Failed to fetch auctions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  // --- 2. Check Participation ---
  const checkParticipations = async (auctionIds: number[]) => {
    if (!isAuthenticated) return;

    try {
      const results = await Promise.all(
        auctionIds.map(async (id) => {
          try {
            const status = await apiClient.participations.getStatus(id);
            return { id, isParticipant: status.is_registered };
          } catch {
            return { id, isParticipant: false };
          }
        })
      );

      const map: Record<number, boolean> = {};
      results.forEach(({ id, isParticipant }) => {
        map[id] = isParticipant;
      });
      setParticipationMap(map);
    } catch (error) {
      console.error('Failed to check participations:', error);
    }
  };

  // --- 3. Handle Click "Place Bid" Button ---
  const handlePlaceBidClick = async (auction: SearchAuctionResult) => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to place bids',
        variant: 'destructive',
      });
      return;
    }

    setSelectedAuction(auction);

    // Tính toán giá trị khởi tạo cho ô input
    const currentPrice = auction.highestBidPrice || auction.priceStep;
    setInputBidAmount(currentPrice + auction.priceStep);
    setDepositAmount(auction.priceStep * 10);

    setIsDialogOpen(true);

    if (participationMap[auction.auctionID] === undefined) {
      setIsCheckingParticipation({ ...isCheckingParticipation, [auction.auctionID]: true });
      try {
        const detail = await apiClient.auctions.getById(auction.auctionID);
        setParticipationMap({
          ...participationMap,
          [auction.auctionID]: !!detail.userParticipation,
        });
      } catch (error) {
        console.error('Failed to check participation:', error);
      } finally {
        setIsCheckingParticipation({ ...isCheckingParticipation, [auction.auctionID]: false });
      }
    }
  };

  // --- Auto-update deposit based on bid amount ---
  useEffect(() => {
    if (selectedAuction && inputBidAmount) {
      // Rule: In this auction mode, Deposit = Bid Amount (100% collateral)
      // They pay the full bid amount upfront.
      const minDeposit = selectedAuction.priceStep * 10;
      const calculatedDeposit = Math.max(minDeposit, inputBidAmount);
      setDepositAmount(calculatedDeposit);
    }
  }, [inputBidAmount, selectedAuction]);

  // --- 4. Handle Bid Success ---
  const handleBidPlaced = () => {
    setIsDialogOpen(false);
    toast({
      title: 'Success!',
      description: 'Your bid has been placed successfully',
    });
    refreshAuctions();
  };

  const refreshAuctions = async () => {
    try {
      const response = await apiClient.search.auctionsByQuery({
        auction_status: 'pending',
        limit: 100,
      });
      setAuctions(response?.items || []);
      setFilteredAuctions(response?.items || []);
    } catch (error) {
      console.error('Failed to refresh auctions:', error);
    }
  };

  // --- 5. Handle Register & Prepare Auto-Bid ---
  const handleRegister = async (auctionId: number, bidAmount?: number) => {
    setIsRegistering(prev => ({ ...prev, [auctionId]: true }));

    // Validation
    if (selectedAuction && bidAmount) {
      const currentPrice = selectedAuction.highestBidPrice || selectedAuction.priceStep;
      const minBid = currentPrice + selectedAuction.priceStep;

      if (bidAmount < minBid) {
        toast({
          title: 'Invalid Bid Amount',
          description: `Bid must be at least ${formatPrice(minBid)}`,
          variant: 'destructive',
        });
        setIsRegistering(prev => ({ ...prev, [auctionId]: false }));
        return;
      }

      setPendingBid({ auctionId, amount: bidAmount });
    }

    try {
      const response: any = await apiClient.participations.register(auctionId, depositAmount);
      const depositData = response.data || response;

      setDepositInfo(depositData);
      setShowDepositDialog(true);
      setIsDialogOpen(false);

      toast({
        title: 'Registration Initiated',
        description: 'Please complete the deposit payment.',
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to register for auction';

      if (errorMessage.toLowerCase().includes('already registered')) {
        try {
          const status = await apiClient.participations.getStatus(auctionId);
          setParticipationMap(prev => ({ ...prev, [auctionId]: status.is_registered }));
          toast({
            title: 'Already Registered',
            description: 'You are already registered. Please place your bid now.',
          });
          setIsDialogOpen(true);
        } catch {
          setParticipationMap(prev => ({ ...prev, [auctionId]: true }));
        }
      } else {
        toast({
          title: 'Registration Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsRegistering(prev => ({ ...prev, [auctionId]: false }));
    }
  };

  // --- 6. Handle Deposit Completed & Execute Auto-Bid ---
  const handleDepositCompleted = async () => {
    if (!depositInfo) return;

    setShowDepositDialog(false);

    try {
      // 1. Cập nhật trạng thái Registered
      const status = await apiClient.participations.getStatus(depositInfo.auction_id);
      setParticipationMap(prev => ({ ...prev, [depositInfo.auction_id]: status.is_registered }));

      toast({
        title: 'Deposit Completed!',
        description: 'You are now registered for this auction.',
      });

      // 2. Tự động Bid
      if (pendingBid && pendingBid.auctionId === depositInfo.auction_id) {
        try {
          await apiClient.bids.place({
            auctionID: pendingBid.auctionId,
            bidPrice: pendingBid.amount
          });

          toast({
            title: 'Bid Placed Automatically!',
            description: `Your bid of ${formatPrice(pendingBid.amount)} has been successfully placed.`,
            className: "bg-green-600 text-white border-none"
          });

          setAuctions(prev => prev.map(a =>
            a.auctionID === pendingBid.auctionId
              ? { ...a, highestBidPrice: pendingBid.amount, totalBids: (a.totalBids || 0) + 1 }
              : a
          ));

          setPendingBid(null);
          setTimeout(() => refreshAuctions(), 1000);

        } catch (bidError: any) {
          console.error("Auto-bid failed:", bidError);
          const errorDetail = bidError.response?.data?.detail || bidError.message || 'Payment successful but could not place bid automatically.';
          toast({
            title: 'Auto-bid Failed',
            description: errorDetail,
            variant: 'destructive'
          });

          if (selectedAuction?.auctionID === depositInfo.auction_id) {
            setIsDialogOpen(true);
          }
        }
      }

    } catch (error) {
      console.error('Failed to refresh participation status:', error);
    }

    setDepositInfo(null);
    setIsPollingPayment(false);
  };



  useEffect(() => {
    if (!showDepositDialog || !depositInfo?.payment_id) return;
    setIsPollingPayment(true);

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await apiClient.payments.checkStatus(depositInfo.payment_id);
        if (statusResponse.data.is_completed) {
          clearInterval(pollInterval);
          await handleDepositCompleted();
        }
      } catch (error) {
        console.error('Failed to poll payment status:', error);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      setIsPollingPayment(false);
    };
  }, [showDepositDialog, depositInfo?.payment_id]);

  // --- UI Helpers ---
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = auctions.filter(
        (auction) =>
          auction.auctionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          auction.productName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAuctions(filtered);
    } else {
      setFilteredAuctions(auctions);
    }
  }, [searchQuery, auctions]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const calculateTimeRemaining = (endDate: string, timeRemaining?: number | null) => {
    if (timeRemaining !== null && timeRemaining !== undefined) return timeRemaining;
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((end - now) / 1000));
  };

  const hotAuctions = [...filteredAuctions].sort((a, b) => (b.totalBids || 0) - (a.totalBids || 0));
  const recentAuctions = [...filteredAuctions].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const endingSoonAuctions = [...filteredAuctions].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  const renderAuctionList = (auctionList: SearchAuctionResult[]) => {
    if (auctionList.length === 0) {
      return (
        <div className="text-center py-16">
          <Gavel className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">No auctions found</h3>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {auctionList.map((auction) => {
          const currentPrice = auction.highestBidPrice || auction.priceStep;
          return (
            <Card key={auction.auctionID} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="w-full lg:w-48 h-48 rounded-lg overflow-hidden bg-muted shrink-0">
                    {auction.productImage ? (
                      <img src={auction.productImage} alt={auction.auctionName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gavel className="h-12 w-12 text-muted-foreground opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <Link to={`/auctions/${auction.auctionID}`} className="hover:underline">
                          <h3 className="text-xl font-bold mb-1">{auction.auctionName}</h3>
                        </Link>
                        {auction.productName && <p className="text-sm text-muted-foreground">{auction.productName}</p>}
                      </div>
                      {(auction.totalBids || 0) > 0 && (
                        <Badge variant="default" className="shrink-0"><TrendingUp className="h-3 w-3 mr-1" />Hot</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                        <p className="font-bold text-primary text-lg">{formatPrice(currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Bids</p>
                        <p className="font-semibold flex items-center gap-1"><Gavel className="h-4 w-4" />{auction.totalBids || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Price Step</p>
                        <p className="font-semibold">{formatPrice(auction.priceStep)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Time Left</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {(() => {
                            const remaining = calculateTimeRemaining(auction.endDate, auction.timeRemaining);
                            if (remaining > 0) {
                              const hours = Math.floor(remaining / 3600);
                              const minutes = Math.floor((remaining % 3600) / 60);
                              return `${hours}h ${minutes}m`;
                            }
                            return 'Ended';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {isAuthenticated ? (
                        <>
                          {participationMap[auction.auctionID] ? (
                            <>
                              <Button onClick={() => handlePlaceBidClick(auction)}>
                                <Gavel className="mr-2 h-4 w-4" />Place Bid
                              </Button>
                              <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-1" />Registered</Badge>
                            </>
                          ) : (
                            <Button variant="outline" onClick={() => handlePlaceBidClick(auction)}>
                              <UserPlus className="mr-2 h-4 w-4" />Register & Bid
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button asChild><Link to="/login">Login to Bid</Link></Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/auctions/${auction.auctionID}`}>View Details<ExternalLink className="ml-2 h-4 w-4" /></Link>
                      </Button>
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

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Live Bidding</h1>
          <p className="text-muted-foreground">Browse active auctions and place your bids</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-6"><div><p className="text-sm text-muted-foreground">Active Auctions</p><p className="text-2xl font-bold">{auctions.length}</p></div></CardContent></Card>
          <Card><CardContent className="p-6"><div><p className="text-sm text-muted-foreground">Total Bids</p><p className="text-2xl font-bold">{auctions.reduce((sum, a) => sum + (a.totalBids || 0), 0)}</p></div></CardContent></Card>
          <Card><CardContent className="p-6"><div><p className="text-sm text-muted-foreground">Ending Soon</p><p className="text-2xl font-bold">{endingSoonAuctions.slice(0, 5).length}</p></div></CardContent></Card>
          <Card><CardContent className="p-6"><div><p className="text-sm text-muted-foreground">Hot Auctions</p><p className="text-2xl font-bold">{hotAuctions.filter(a => (a.totalBids || 0) > 5).length}</p></div></CardContent></Card>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search auctions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="hot">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hot">Hot ({hotAuctions.length})</TabsTrigger>
              <TabsTrigger value="recent">Recent ({recentAuctions.length})</TabsTrigger>
              <TabsTrigger value="ending">Ending Soon ({endingSoonAuctions.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="hot" className="mt-6">{renderAuctionList(hotAuctions)}</TabsContent>
            <TabsContent value="recent" className="mt-6">{renderAuctionList(recentAuctions)}</TabsContent>
            <TabsContent value="ending" className="mt-6">{renderAuctionList(endingSoonAuctions)}</TabsContent>
          </Tabs>
        )}

        {/* --- MAIN BID DIALOG --- */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Place Your Bid</DialogTitle>
              <DialogDescription>{selectedAuction?.auctionName}</DialogDescription>
            </DialogHeader>

            {selectedAuction && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Price</span>
                    <span className="font-bold text-lg">{formatPrice(selectedAuction.highestBidPrice || selectedAuction.priceStep)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bid Step</span>
                    <span className="font-semibold">{formatPrice(selectedAuction.priceStep)}</span>
                  </div>
                </div>

                {participationMap[selectedAuction.auctionID] ? (
                  <PlaceBidForm
                    auctionId={selectedAuction.auctionID}
                    currentPrice={selectedAuction.highestBidPrice || selectedAuction.priceStep}
                    priceStep={selectedAuction.priceStep}
                    isParticipant={true}
                    onBidPlaced={handleBidPlaced}
                  />
                ) : (
                  <div className="py-2 space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-amber-50 text-amber-900 rounded-lg border border-amber-200">
                      <UserPlus className="h-5 w-5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold">Registration Required</p>
                        <p>You need to pay a deposit to participate.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Deposit Amount Required (VND)</Label>
                      <div className="p-3 bg-muted rounded-md font-mono font-medium border">
                        {formatPrice(depositAmount)}
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        Deposit matches Bid Amount (Min floor: {formatPrice(selectedAuction.priceStep * 10)})
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-bid-amount">Enter your bid amount</Label>
                      <div className="relative">
                        <Input
                          id="register-bid-amount"
                          type="number"
                          value={inputBidAmount}
                          onChange={(e) => setInputBidAmount(Number(e.target.value))}
                          className="pl-8 font-mono text-lg"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₫</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        Min bid: {formatPrice((selectedAuction.highestBidPrice || selectedAuction.priceStep) + selectedAuction.priceStep)}
                      </p>
                    </div>

                    <Button
                      className="w-full h-11 text-base"
                      onClick={() => handleRegister(selectedAuction.auctionID, inputBidAmount)}
                      disabled={isRegistering[selectedAuction.auctionID]}
                    >
                      {isRegistering[selectedAuction.auctionID] ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                      ) : (
                        <><UserPlus className="mr-2 h-4 w-4" />Register & Place Bid ({formatPrice(inputBidAmount)})</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* --- DEPOSIT DIALOG --- */}
        <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Complete Deposit Payment</DialogTitle>
              <DialogDescription>{depositInfo?.auction_name}</DialogDescription>
            </DialogHeader>

            {depositInfo && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Deposit Amount</p>
                  <p className="text-3xl font-bold text-primary">{depositInfo.deposit_amount}</p>
                </div>

                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  {depositInfo.qr_url ? (
                    <div className="w-64 h-64 p-2 bg-white rounded-lg">
                      <QRCode
                        value={depositInfo.qr_url}
                        style={{ height: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg"><p className="text-sm text-muted-foreground">No QR</p></div>
                  )}
                </div>

                <div className="space-y-2 rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Scan QR to pay. Your bid will be placed automatically after payment.</p>
                </div>

                {isPollingPayment && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <p className="text-sm text-blue-700 font-medium">Waiting for payment confirmation...</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}