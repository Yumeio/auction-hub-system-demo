import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiClient } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Auction, Product, Bid } from '@/api/types';
import {
  CreditCard,
  Building,
  Wallet,
  CheckCircle,
  Loader2,
  Package,
  MapPin,
  User,
  AlertCircle,
  ArrowLeft,
  QrCode
} from 'lucide-react';

export default function Payment() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [winningBid, setWinningBid] = useState<Bid | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [existingPayment, setExistingPayment] = useState<any | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    address: user?.address || '',
    phoneNumber: user?.phoneNumber || '',
  });

  const [qrParams, setQrParams] = useState<{
    qrUrl: string;
    amount: number;
    paymentId: number;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      if (!auctionId) return;

      try {
        const auctionData = await apiClient.auctions.getById(parseInt(auctionId));
        setAuction(auctionData.auction);
        setProduct(auctionData.product);

        // Check if user won this auction
        if (auctionData.auction.bidWinnerID !== user?.accountID) {
          toast({
            title: 'Access Denied',
            description: 'You did not win this auction',
            variant: 'destructive',
          });
          navigate('/dashboard/bids');
          return;
        }

        // Get winning bid details
        if (auctionData.highestBid) {
          setWinningBid(auctionData.highestBid);
        }

        // Check for existing payment
        try {
          const paymentData = await apiClient.payments.getAuctionPayment(parseInt(auctionId)) as any;
          if (paymentData.success && paymentData.data) {
            setExistingPayment(paymentData.data);
            // If sending returning to page and payment is completed, show that
            if (paymentData.data.payment_status === 'completed') {
              toast({
                title: 'Payment Completed',
                description: 'This auction has already been paid for.',
              });
              navigate('/dashboard/payments');
            }
          }
        } catch (err) {
          // No existing payment found, which is fine
          console.log('No existing payment found');
        }

      } catch (error) {
        console.error('Failed to fetch auction:', error);
        toast({
          title: 'Error',
          description: 'Failed to load auction details',
          variant: 'destructive',
        });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [auctionId, isAuthenticated, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionId || !winningBid) return;

    setIsSubmitting(true);

    try {
      const result = await apiClient.payments.create({
        auction_id: parseInt(auctionId),
        first_name: formData.firstName,
        last_name: formData.lastName,
        user_address: formData.address,
        user_payment_method: paymentMethod,
      }) as any;

      if (result.success && result.data && result.data.qr_url) {
        setQrParams({
          qrUrl: result.data.qr_url,
          amount: result.data.amount_raw || result.data.amount,
          paymentId: result.data.payment_id,
        });
        toast({
          title: 'Payment Created',
          description: 'Please scan the QR code to complete payment.',
        });
      } else {
        toast({
          title: 'Payment Initiated!',
          description: 'Your payment has been submitted for processing.',
        });
        navigate('/dashboard/payments');
      }
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-16">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!auction || !product || !winningBid) {
    return (
      <MainLayout>
        <div className="container py-16">
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive opacity-50" />
              <h3 className="text-lg font-medium mb-2">Auction Not Found</h3>
              <p className="text-sm text-muted-foreground mb-6">
                The auction you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link to="/dashboard/bids">View My Bids</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const paymentAmount = winningBid.bidPrice;



  if (qrParams) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-2xl">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => setQrParams(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Scan to Pay</CardTitle>
              <CardDescription>
                Scan this QR code with your banking app or e-wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center p-6 border rounded-lg bg-white">
                <img
                  src={qrParams.qrUrl} // The backend returns a URL (generated from token)
                  alt="Payment QR Code"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Amount to Pay</p>
                <p className="text-3xl font-bold text-primary">
                  {formatPrice(typeof qrParams.amount === 'number' ? qrParams.amount : parseFloat(qrParams.amount))}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/dashboard/payments')}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  I have completed payment
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/dashboard/payments')}
                >
                  Do this later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Complete Payment</h1>
            <p className="text-muted-foreground mt-1">
              Congratulations on winning the auction!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Shipping Information
                </CardTitle>
                <CardDescription>
                  Enter your shipping details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Shipping Address *</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
                <CardDescription>
                  Choose your preferred payment method
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="bank_transfer" id="bank" />
                    <Label htmlFor="bank" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Bank Transfer</p>
                        <p className="text-xs text-muted-foreground">
                          Transfer directly to our bank account
                        </p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="e_wallet" id="wallet" />
                    <Label htmlFor="wallet" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">E-Wallet</p>
                        <p className="text-xs text-muted-foreground">
                          Pay with Momo, ZaloPay, or VNPay
                        </p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="qr_code" id="qr" />
                    <Label htmlFor="qr" className="flex items-center gap-3 cursor-pointer flex-1">
                      <QrCode className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Scan QR Code</p>
                        <p className="text-xs text-muted-foreground">
                          MoMo billing, VietQR, ZaloPay
                        </p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="credit_card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Credit/Debit Card</p>
                        <p className="text-xs text-muted-foreground">
                          Visa, Mastercard, or JCB
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Button
              onClick={existingPayment && existingPayment.payment_status === 'pending' ? () => {
                if (existingPayment.qr_url) {
                  setQrParams({
                    qrUrl: existingPayment.qr_url,
                    amount: existingPayment.amount_raw,
                    paymentId: existingPayment.payment_id
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Could not retrieve payment details. Please try creating a new one or contacting support.",
                    variant: "destructive"
                  });
                }
              } : handleSubmit}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {existingPayment && existingPayment.payment_status === 'pending' ? (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Resume Payment (Scan QR)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete Payment
                    </>
                  )}
                </>
              )}
            </Button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Info */}
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.product_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {product.product_type}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {auction.auctionName}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Winning Bid</span>
                    <span className="font-medium">{formatPrice(winningBid.bidPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">Calculated later</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">Included</span>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(paymentAmount)}
                  </span>
                </div>

                {/* Security Notice */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                    <span>
                      Your payment information is secure and encrypted. We never store your card details.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}