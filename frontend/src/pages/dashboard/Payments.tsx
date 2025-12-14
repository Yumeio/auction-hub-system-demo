import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/api';
import type { PaymentWithDetails } from '@/api/types';
import {
  Loader2,
  ExternalLink,
  Receipt,
  Search,
  Download,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  FileText,
  RotateCcw,
  Eye,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function Payments() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 100000000]);
  const [showFilters, setShowFilters] = useState(false);

  // Dialog state
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    fetchPayments();
    // Auto-refresh every 30 seconds for pending payments
    const interval = setInterval(() => {
      fetchPayments(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayments = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const response = await apiClient.payments.getMyPayments({ limit: 1000 });
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payments. Please try again.',
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

  const getStatusConfig = (status: string) => {
    const configs: Record<
      string,
      {
        icon: any;
        className: string;
        label: string;
      }
    > = {
      completed: {
        icon: CheckCircle,
        className: 'bg-green-500/10 text-green-600 border-green-200',
        label: 'Completed',
      },
      pending: {
        icon: Clock,
        className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
        label: 'Pending',
      },
      processing: {
        icon: Clock,
        className: 'bg-blue-500/10 text-blue-600 border-blue-200',
        label: 'Processing',
      },
      failed: {
        icon: XCircle,
        className: 'bg-destructive/10 text-destructive border-destructive/20',
        label: 'Failed',
      },
      refunded: {
        icon: Receipt,
        className: 'bg-purple-500/10 text-purple-600 border-purple-200',
        label: 'Refunded',
      },
      cancelled: {
        icon: XCircle,
        className: 'bg-muted text-muted-foreground',
        label: 'Cancelled',
      },
    };
    return configs[status] || configs.pending;
  };

  // Get payment progress percentage
  const getPaymentProgress = (status: string) => {
    const progressMap: Record<string, number> = {
      pending: 25,
      processing: 50,
      completed: 100,
      failed: 0,
      refunded: 100,
      cancelled: 0,
    };
    return progressMap[status] || 0;
  };

  // Advanced filtering
  const filteredPayments = useMemo(() => {
    let filtered = [...payments];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (payment) =>
          payment.auction_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.transactionID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.paymentID.toString().includes(searchQuery)
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((payment) =>
        isAfter(parseISO(payment.createdAt), dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter((payment) => isBefore(parseISO(payment.createdAt), dateTo));
    }

    // Amount range filter
    filtered = filtered.filter(
      (payment) =>
        payment.paymentAmount >= amountRange[0] && payment.paymentAmount <= amountRange[1]
    );

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'amount':
          comparison = b.paymentAmount - a.paymentAmount;
          break;
        case 'status':
          const statusOrder = {
            pending: 0,
            processing: 1,
            completed: 2,
            failed: 3,
            refunded: 4,
            cancelled: 5,
          };
          comparison =
            (statusOrder[a.paymentStatus as keyof typeof statusOrder] || 6) -
            (statusOrder[b.paymentStatus as keyof typeof statusOrder] || 6);
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [payments, searchQuery, dateFrom, dateTo, amountRange, sortBy, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((p) => p.paymentStatus === 'pending').length;
    const completed = payments.filter((p) => p.paymentStatus === 'completed').length;
    const failed = payments.filter((p) => ['failed', 'refunded'].includes(p.paymentStatus))
      .length;
    const totalAmount = payments.reduce((sum, p) => sum + p.paymentAmount, 0);
    const completedAmount = payments
      .filter((p) => p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + p.paymentAmount, 0);
    const pendingAmount = payments
      .filter((p) => p.paymentStatus === 'pending')
      .reduce((sum, p) => sum + p.paymentAmount, 0);
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    const avgPayment = total > 0 ? totalAmount / total : 0;

    return {
      total,
      pending,
      completed,
      failed,
      totalAmount,
      completedAmount,
      pendingAmount,
      successRate,
      avgPayment,
    };
  }, [payments]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Payment ID',
      'Date',
      'Auction',
      'Product',
      'Amount',
      'Status',
      'Transaction ID',
      'Payment Method',
    ];
    const rows = filteredPayments.map((payment) => [
      payment.paymentID,
      format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm'),
      payment.auction_name || 'N/A',
      payment.product_name || 'N/A',
      payment.paymentAmount,
      payment.paymentStatus,
      payment.transactionID || 'N/A',
      payment.userPaymentMethod || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: 'Export Successful',
      description: `Exported ${filteredPayments.length} payments to CSV`,
    });
  };

  // Retry failed payment
  const retryPayment = async (paymentId: number) => {
    try {
      await apiClient.payments.process(paymentId);
      toast({
        title: 'Payment Retry Initiated',
        description: 'Your payment is being processed again.',
      });
      fetchPayments();
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: 'Unable to retry payment. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setAmountRange([0, 100000000]);
    setSortBy('date');
    setSortOrder('desc');
  };

  // View payment details
  const viewDetails = (payment: PaymentWithDetails) => {
    navigate(`/dashboard/payments/${payment.paymentID}`);
  };

  const pendingPayments = filteredPayments.filter((p) => p.paymentStatus === 'pending');
  const completedPayments = filteredPayments.filter((p) => p.paymentStatus === 'completed');
  const failedPayments = filteredPayments.filter((p) =>
    ['failed', 'refunded'].includes(p.paymentStatus)
  );

  const calculateTotal = (paymentList: PaymentWithDetails[]) => {
    return paymentList.reduce((sum, payment) => sum + payment.paymentAmount, 0);
  };

  const renderPaymentTable = (paymentList: PaymentWithDetails[]) => {
    if (paymentList.length === 0) {
      return (
        <div className="text-center py-16">
          <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">No payments found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery || dateFrom || dateTo
              ? 'Try adjusting your filters'
              : 'Your payment history will appear here'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Total Summary */}
        <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-3xl font-bold">{formatPrice(calculateTotal(paymentList))}</p>
            </div>
            <DollarSign className="h-12 w-12 text-primary opacity-20" />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Auction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentList.map((payment) => {
                  const statusConfig = getStatusConfig(payment.paymentStatus);
                  const StatusIcon = statusConfig.icon;
                  const progress = getPaymentProgress(payment.paymentStatus);

                  return (
                    <TableRow key={payment.paymentID} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{format(new Date(payment.createdAt), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(payment.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <Link
                            to={`/auctions/${payment.auctionID}`}
                            className="hover:underline text-primary font-medium truncate"
                          >
                            {payment.auction_name || `Auction #${payment.auctionID}`}
                          </Link>
                          {payment.product_name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {payment.product_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {formatPrice(payment.paymentAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(payment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {payment.paymentStatus === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryPayment(payment.paymentID)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/auctions/${payment.auctionID}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
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
            <h1 className="text-3xl font-bold">Payments</h1>
            {isRefreshing && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-muted-foreground mt-1">Track your auction payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchPayments()}>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPrice(stats.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPrice(stats.pendingAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPrice(stats.completedAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completed}/{stats.total} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatPrice(stats.avgPayment)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by auction, product, transaction ID..."
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
                      <SelectItem value="amount">Amount</SelectItem>
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

              {/* Amount Range */}
              <div className="space-y-2">
                <Label>
                  Amount Range: {formatPrice(amountRange[0])} - {formatPrice(amountRange[1])}
                </Label>
                <Slider
                  min={0}
                  max={100000000}
                  step={1000000}
                  value={amountRange}
                  onValueChange={(v) => setAmountRange(v as [number, number])}
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
      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All <span className="ml-1 text-xs">({filteredPayments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending <span className="ml-1 text-xs">({pendingPayments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed <span className="ml-1 text-xs">({completedPayments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed <span className="ml-1 text-xs">({failedPayments.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {renderPaymentTable(filteredPayments)}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          {renderPaymentTable(pendingPayments)}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {renderPaymentTable(completedPayments)}
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          {renderPaymentTable(failedPayments)}
        </TabsContent>
      </Tabs>

      {/* Payment Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Complete information about this payment transaction
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {/* Payment Status */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatusConfig(selectedPayment.paymentStatus).className}>
                      {getStatusConfig(selectedPayment.paymentStatus).label}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">
                    {formatPrice(selectedPayment.paymentAmount)}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-medium">
                    {getPaymentProgress(selectedPayment.paymentStatus)}%
                  </span>
                </div>
                <Progress value={getPaymentProgress(selectedPayment.paymentStatus)} />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment ID</p>
                  <p className="font-medium">#{selectedPayment.paymentID}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <p className="font-medium font-mono text-xs">
                    {selectedPayment.transactionID || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Auction</p>
                  <Link
                    to={`/auctions/${selectedPayment.auctionID}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {selectedPayment.auction_name || `Auction #${selectedPayment.auctionID}`}
                  </Link>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedPayment.product_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{selectedPayment.userPaymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">
                    {format(new Date(selectedPayment.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Shipping Address</p>
                <p className="font-medium">
                  {selectedPayment.firstName} {selectedPayment.lastName}
                </p>
                <p className="text-sm">{selectedPayment.userAddress}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {selectedPayment.paymentStatus === 'failed' && (
                  <Button onClick={() => retryPayment(selectedPayment.paymentID)} className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Payment
                  </Button>
                )}
                <Button variant="outline" asChild className="flex-1">
                  <Link to={`/auctions/${selectedPayment.auctionID}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Auction
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
