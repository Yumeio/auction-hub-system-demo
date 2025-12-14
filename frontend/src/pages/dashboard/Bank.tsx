import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api';
import { Loader2, ArrowLeft, QrCode, CheckCircle, AlertCircle, Calendar, CreditCard, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import QRCode from "react-qr-code";

export default function Bank() {
    const { paymentId } = useParams<{ paymentId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [payment, setPayment] = useState<any | null>(null);
    const [qrUrl, setQrUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!paymentId) return;

        const fetchPaymentDetails = async () => {
            try {
                setLoading(true);
                // We'll use getStatus endpoint which returns basic details
                const response = await apiClient.payments.checkStatus(parseInt(paymentId));
                if (response.success && response.data) {
                    console.log("Payment Data:", response.data);
                    const data = response.data as any;
                    setPayment(data);

                    // Prefer using QR URL from the status response if available
                    if (data.qr_url) {
                        setQrUrl(data.qr_url);
                    }
                    // Fallback: If pending and no QR code, try to get QR URL via auction payment endpoint
                    else if (data.payment_status === 'pending') {
                        try {
                            if (response.data.auction_id) {
                                const auctionId = parseInt(response.data.auction_id.toString());
                                const auctionPayment = await apiClient.payments.getAuctionPayment(auctionId) as any;

                                if (auctionPayment.success && auctionPayment.data && auctionPayment.data.qr_url) {
                                    setQrUrl(auctionPayment.data.qr_url);
                                }
                            }
                        } catch (e) {
                            console.error("Could not fetch QR details", e);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch payment:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load payment details',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentDetails();

        // Auto refresh every 5s to check for completion
        const interval = setInterval(fetchPaymentDetails, 5000);
        return () => clearInterval(interval);
    }, [paymentId]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(price);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!payment) {
        return (
            <div className="container py-8">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                        <p className="text-lg font-medium">Payment not found</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/payments')}>
                            Back to Payments
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container py-8 max-w-3xl">
            <div className="mb-6">
                <Button variant="ghost" onClick={() => navigate('/dashboard/payments')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Payments
                </Button>
            </div>

            <div className="grid gap-6">
                {/* Header Status Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">Payment Details</CardTitle>
                                <CardDescription>ID: #{payment.payment_id}</CardDescription>
                            </div>
                            <Badge
                                variant={
                                    payment.payment_status === 'completed' ? 'default' :
                                        payment.payment_status === 'failed' ? 'destructive' : 'secondary'
                                }
                                className="text-base px-3 py-1 capitalize"
                            >
                                {payment.payment_status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" /> Amount
                                </span>
                                <p className="font-semibold text-lg">{formatPrice(payment.amount)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Date
                                </span>
                                <p className="font-medium text-sm">
                                    {payment.created_at ? format(new Date(payment.created_at), 'PPP') : 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" /> Type
                                </span>
                                <p className="font-medium text-sm capitalize">
                                    {payment.payment_type?.replace('_', ' ') || 'Payment'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* QR Code Section - Only if Pending and QR available */}
                {payment.payment_status === 'pending' && qrUrl && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-2 p-2 rounded-full bg-background border shadow-sm">
                                <QrCode className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Scan to Pay</CardTitle>
                            <CardDescription>
                                Scan this code to complete your payment
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center pb-8">
                            <div className="bg-white p-4 rounded-xl border shadow-sm mb-4">
                                <QRCode
                                    value={qrUrl}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">
                                Open your banking app or e-wallet and scan the code above. The payment will be processed automatically.
                            </p>
                            <Button onClick={() => window.location.reload()}>
                                I have completed the payment
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Completed Success View */}
                {payment.payment_status === 'completed' && (
                    <Card className="bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800">
                        <CardContent className="flex flex-col items-center py-8 text-center">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4 dark:bg-green-900/30">
                                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                                Payment Successful
                            </h3>
                            <p className="text-green-700 dark:text-green-300 text-sm max-w-md">
                                Your payment has been processed and confirmed. You will receive a confirmation email shortly.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
