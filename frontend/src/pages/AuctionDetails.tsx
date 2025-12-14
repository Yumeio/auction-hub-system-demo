import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { CountdownTimer } from '@/components/auction/CountdownTimer';
import { BidHistory } from '@/components/auction/BidHistory';
import { PlaceBidForm } from '@/components/auction/PlaceBidForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAuctionSSE } from '@/hooks/use-sse';
import { useToast } from '@/hooks/use-toast';
import type { AuctionDetailResponse, BidWithDetails } from '@/api/types';
import { AuctionStatus, BidStatus, ShippingStatus, ApprovalStatus } from '@/api/types';
import { Loader2, Users, Gavel, Clock, ArrowLeft, CheckCircle, XCircle, Package, Award, Image as ImageIcon } from 'lucide-react';

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [auctionData, setAuctionData] = useState<AuctionDetailResponse | null>(null);
  const [bids, setBids] = useState<BidWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState<number>(0);

  const auctionId = id ? parseInt(id) : null;

  // Helper functions for status colors
  const getAuctionStatusStyle = (status: string) => {
    switch (status) {
      case AuctionStatus.PENDING:
        return 'bg-green-500 hover:bg-green-600 text-white';
      case AuctionStatus.SCHEDULED:
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case AuctionStatus.COMPLETED:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
      case AuctionStatus.CANCELLED:
        return 'bg-red-500 hover:bg-red-600 text-white';
      case AuctionStatus.DRAFT:
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const getShippingStatusStyle = (status: string) => {
    switch (status) {
      case ShippingStatus.PENDING:
        return 'border-yellow-500 text-yellow-700 bg-yellow-50';
      case ShippingStatus.PROCESSING:
        return 'border-blue-500 text-blue-700 bg-blue-50';
      case ShippingStatus.SHIPPED:
        return 'border-purple-500 text-purple-700 bg-purple-50';
      case ShippingStatus.DELIVERED:
        return 'border-green-500 text-green-700 bg-green-50';
      default:
        return 'border-gray-300 text-gray-700 bg-gray-50';
    }
  };

  const getApprovalStatusStyle = (status: string) => {
    switch (status) {
      case ApprovalStatus.PENDING:
        return 'border-yellow-500 text-yellow-700 bg-yellow-50';
      case ApprovalStatus.APPROVED:
        return 'border-green-500 text-green-700 bg-green-50';
      case ApprovalStatus.REJECTED:
        return 'border-red-500 text-red-700 bg-red-50';
      default:
        return 'border-gray-300 text-gray-700 bg-gray-50';
    }
  };

  const handleSSEUpdate = useCallback((data: AuctionDetailResponse) => {
    setAuctionData(data);
  }, []);

  useAuctionSSE(auctionId, handleSSEUpdate);

  const fetchAuctionData = async () => {
    if (!auctionId) return;

    try {
      const [auctionResponse, bidsResponse] = await Promise.all([
        apiClient.auctions.getById(auctionId),
        apiClient.bids.getAuctionBids(auctionId, { limit: 50 }),
      ]);

      setAuctionData(auctionResponse);
      if (auctionResponse.auction) {
        setDepositAmount(auctionResponse.auction.priceStep * 10);
      }
      setBids(bidsResponse?.items || []);
    } catch (error: any) {
      console.error('Failed to fetch auction:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to load auction details.',
        variant: 'destructive',
      });
      // Don't set auctionData to null on error if it was already loaded
      if (!auctionData) {
        setAuctionData(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionData();
  }, [auctionId]);

  const handleRegister = async () => {
    if (!auctionId) return;

    setIsRegistering(true);
    try {
      await apiClient.participations.register(auctionId, depositAmount);
      toast({
        title: 'Registered!',
        description: 'You are now registered for this auction.',
      });
      fetchAuctionData();
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBidPlaced = () => {
    fetchAuctionData();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!auctionData) {
    return (
      <MainLayout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Auction Not Found</h1>
          <Button onClick={() => navigate('/auctions')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Auctions
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { auction, product, highestBid, totalBids, totalParticipants, userParticipation } = auctionData;
  const isActive = auction?.auctionStatus === 'pending';
  const isParticipant = !!userParticipation;
  const currentPrice = highestBid?.bidPrice || product?.initial_price || 0;
  const isWinning = highestBid?.bidderID === user?.accountID;

  // Helper function to get full image URL
  const getImageUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    // If already full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, prepend API base URL
    return `http://localhost:8000/${imagePath}`;
  };

  const productImages = [
    getImageUrl(product?.image_url),
    ...(Array.isArray(product?.additional_images)
      ? product.additional_images.map(img => getImageUrl(img))
      : []
    ),
  ].filter(Boolean) as string[];

  return (
    <MainLayout>
      <div className="container py-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <button onClick={() => navigate('/')} className="hover:text-foreground">
            Home
          </button>
          <span>/</span>
          <button onClick={() => navigate('/auctions')} className="hover:text-foreground">
            Auctions
          </button>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {auction?.auctionName || 'Auction Details'}
          </span>
        </nav>

        {/* Back button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(currentPrice)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Current Bid</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalBids}</div>
                <p className="text-xs text-muted-foreground mt-1">Total Bids</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalParticipants}</div>
                <p className="text-xs text-muted-foreground mt-1">Participants</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Badge className={`text-base py-1.5 px-4 ${getAuctionStatusStyle(auction?.auctionStatus || '')}`}>
                  {auction?.auctionStatus || 'Unknown'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Status</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Product Images & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted relative group">
                {productImages.length > 0 ? (
                  <>
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <img
                      src={productImages[selectedImage]}
                      alt={product?.product_name || 'Product image'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onLoad={() => setImageLoading(false)}
                      onLoadStart={() => setImageLoading(true)}
                      onError={(e) => {
                        setImageLoading(false);
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <Gavel className="h-20 w-20 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No image available</p>
                  </div>
                )}
                {productImages.length > 0 && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {selectedImage + 1} / {productImages.length}
                  </div>
                )}
              </div>

              {productImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedImage(idx);
                        setImageLoading(true);
                      }}
                      className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all hover:border-primary/50 ${selectedImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                        }`}
                    >
                      <img src={img} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <Badge className="mb-3 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200">
                    {product?.product_type || 'Unknown'}
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">{auction?.auctionName || 'Auction'}</h1>
                  <p className="text-sm text-muted-foreground">
                    Product #{product?.product_id} • Auction #{auction?.auctionID}
                  </p>
                </div>
                <Badge className={getAuctionStatusStyle(auction?.auctionStatus || '')}>
                  {auction?.auctionStatus || 'Unknown'}
                </Badge>
              </div>

              <Tabs defaultValue="description" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="description">Description</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="images">
                    <ImageIcon className="h-4 w-4 mr-1" />
                    Images
                  </TabsTrigger>
                  <TabsTrigger value="shipping">Shipping</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-4">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {product?.product_description || 'No description available.'}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="images" className="mt-4">
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Product Images Gallery
                    </h3>
                    {productImages.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {productImages.map((img, idx) => (
                          <div
                            key={idx}
                            className="aspect-square rounded-lg overflow-hidden border-2 border-muted hover:border-primary transition-colors cursor-pointer group"
                            onClick={() => {
                              setSelectedImage(idx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <img
                              src={img}
                              alt={`Product image ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="16" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <span className="text-white opacity-0 group-hover:opacity-100 font-semibold">
                                View
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-muted rounded-lg">
                        <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-muted-foreground">No additional images available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="details" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Starting Price</span>
                      <p className="font-semibold text-lg">{formatPrice(product?.initial_price || 0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Price Step</span>
                      <p className="font-semibold text-lg">{formatPrice(auction?.priceStep || 0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Start Date</span>
                      <p className="font-semibold">
                        {auction?.startDate ? new Date(auction.startDate).toLocaleString('vi-VN') : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">End Date</span>
                      <p className="font-semibold">
                        {auction?.endDate ? new Date(auction.endDate).toLocaleString('vi-VN') : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Auction ID</span>
                      <p className="font-semibold">#{auction?.auctionID}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Product ID</span>
                      <p className="font-semibold">#{product?.product_id}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Product Type</span>
                      <p className="font-semibold capitalize">{product?.product_type || 'N/A'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground block mb-2">Approval Status</span>
                      <Badge className={getApprovalStatusStyle(product?.approval_status || '')} variant="outline">
                        <Award className="h-3 w-3 mr-1" />
                        {product?.approval_status || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="shipping" className="mt-4">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground block mb-2">Shipping Status</span>
                      <Badge className={getShippingStatusStyle(product?.shipping_status || 'pending')} variant="outline">
                        <Package className="h-3 w-3 mr-1" />
                        {product?.shipping_status || 'pending'}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground block mb-2">Important Information</span>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        <li>• Winning bidder must complete payment within 48 hours</li>
                        <li>• Deposit will be refunded to non-winning participants</li>
                        <li>• Shipping calculated after auction ends</li>
                        <li>• All sales are final</li>
                      </ul>
                    </div>
                    {product?.created_at && (
                      <div className="p-4 rounded-lg bg-muted">
                        <span className="text-sm text-muted-foreground block mb-1">Listed Date</span>
                        <p className="font-medium">
                          {new Date(product.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right: Bidding Panel */}
          <div className="space-y-6">
            {/* Timer Card */}
            {isActive && auction?.endDate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Time Remaining
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CountdownTimer endDate={auction.endDate} variant="large" />
                </CardContent>
              </Card>
            )}

            {/* Current Price */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">Current Bid</span>
                  <p className="text-4xl font-bold text-primary mt-1">
                    {formatPrice(currentPrice)}
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gavel className="h-4 w-4" />
                      {totalBids} bids
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {totalParticipants} participants
                    </span>
                  </div>
                </div>

                {isAuthenticated && isParticipant && (
                  <div className="mt-4 pt-4 border-t">
                    {isWinning ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">You're winning!</span>
                      </div>
                    ) : auctionData.userHighestBid ? (
                      <div className="flex items-center justify-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">You've been outbid</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bidding Actions */}
            {isActive && (
              <Card>
                <CardHeader>
                  <CardTitle>Place Your Bid</CardTitle>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center space-y-4">
                      <p className="text-muted-foreground">
                        Sign in to participate in this auction
                      </p>
                      <Button onClick={() => navigate('/login')} className="w-full">
                        Sign In to Bid
                      </Button>
                    </div>
                  ) : !isParticipant ? (
                    <div className="space-y-4">
                      <p className="text-center text-muted-foreground">
                        Register for this auction to start bidding
                      </p>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Deposit Amount (VND)</label>
                        <Input
                          type="number"
                          value={depositAmount || ''}
                          onChange={(e) => setDepositAmount(Number(e.target.value))}
                          min={(auction?.priceStep || 0) * 10}
                          placeholder={`Min ${formatPrice((auction?.priceStep || 0) * 10)}`}
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum deposit: {formatPrice((auction?.priceStep || 0) * 10)}
                        </p>
                      </div>

                      <Button
                        onClick={handleRegister}
                        className="w-full"
                        disabled={isRegistering}
                      >
                        {isRegistering ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Registering...
                          </>
                        ) : (
                          'Register to Bid'
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <PlaceBidForm
                        auctionId={auction?.auctionID || 0}
                        currentPrice={currentPrice}
                        priceStep={auction?.priceStep || 0}
                        isParticipant={isParticipant}
                        onBidPlaced={handleBidPlaced}
                      />

                      {/* Quick Bid Buttons */}
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-3">Quick Bid Options</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: '+1 Step', amount: currentPrice + auction?.priceStep || 0 },
                            { label: '+2 Steps', amount: currentPrice + (auction?.priceStep || 0) * 2 },
                            { label: '+5 Steps', amount: currentPrice + (auction?.priceStep || 0) * 5 },
                            { label: '+10 Steps', amount: currentPrice + (auction?.priceStep || 0) * 10 },
                          ].map((option, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="flex flex-col h-auto py-2 hover:bg-primary hover:text-primary-foreground"
                              onClick={async () => {
                                try {
                                  await apiClient.bids.place({
                                    auctionID: auction?.auctionID || 0,
                                    bidPrice: option.amount,
                                  });
                                  toast({
                                    title: 'Bid placed!',
                                    description: `Your bid of ${formatPrice(option.amount)} has been placed.`,
                                  });
                                  handleBidPlaced();
                                } catch (error: any) {
                                  toast({
                                    title: 'Failed to place bid',
                                    description: error.response?.data?.detail || 'Please try again.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <span className="text-xs">{option.label}</span>
                              <span className="font-semibold">{formatPrice(option.amount)}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bid History */}
            <Card>
              <CardHeader>
                <CardTitle>Bid History</CardTitle>
              </CardHeader>
              <CardContent>
                <BidHistory bids={bids} currentUserId={user?.accountID} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
